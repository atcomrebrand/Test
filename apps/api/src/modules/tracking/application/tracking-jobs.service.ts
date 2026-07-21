import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { TrackingJobRepository } from "../domain/tracking-job.repository";
import { estimateJobHourlyRate } from "../domain/job-hourly-estimate";
import { TrackingAuditService } from "./tracking-audit.service";
import { CreateTrackingJobDto, UpdateTrackingJobDto } from "./dto/tracking-job.dto";

@Injectable()
export class TrackingJobsService {
  constructor(
    private readonly jobs: TrackingJobRepository,
    private readonly audit: TrackingAuditService,
  ) {}

  async findAll(userId: string) {
    const jobs = await this.jobs.findAllByUser(userId);
    return jobs.map((job) => ({ ...job, estimatedHourlyRate: this.estimateHourlyRate(job) }));
  }

  async findOne(userId: string, id: string) {
    const job = await this.getOwned(userId, id);
    return { ...job, estimatedHourlyRate: this.estimateHourlyRate(job) };
  }

  async create(userId: string, dto: CreateTrackingJobDto) {
    const job = await this.jobs.create({
      userId,
      name: dto.name,
      company: dto.company,
      client: dto.client,
      monthlyValue: dto.monthlyValue,
      expectedHoursPerDay: dto.expectedHoursPerDay,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      paymentMethod: dto.paymentMethod,
      paymentDay: dto.paymentDay,
      color: dto.color,
      weekdays: dto.weekdays,
      notes: dto.notes,
    });
    await this.audit.log(userId, "TrackingJob", job.id, "CREATE", null, job);
    return job;
  }

  async update(userId: string, id: string, dto: UpdateTrackingJobDto) {
    const before = await this.getOwned(userId, id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    const after = await this.jobs.update(id, data);
    await this.audit.log(userId, "TrackingJob", id, "UPDATE", before, after);
    return after;
  }

  async remove(userId: string, id: string) {
    const before = await this.getOwned(userId, id);
    await this.jobs.softDelete(id);
    await this.audit.log(userId, "TrackingJob", id, "DELETE", before, null);
    return { id };
  }

  private estimateHourlyRate(job: { monthlyValue: unknown; expectedHoursPerDay: number; weekdays: number[] }) {
    return estimateJobHourlyRate({
      monthlyValue: Number(job.monthlyValue),
      expectedHoursPerDay: job.expectedHoursPerDay,
      weekdays: job.weekdays,
    });
  }

  private async getOwned(userId: string, id: string) {
    const job = await this.jobs.findById(id);
    if (!job) throw new NotFoundException("Trabalho fixo não encontrado.");
    if (job.userId !== userId) throw new ForbiddenException();
    return job;
  }
}
