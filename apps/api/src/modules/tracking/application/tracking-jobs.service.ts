import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { TrackingJobRepository } from "../domain/tracking-job.repository";
import { estimateJobHourlyRate } from "../domain/job-hourly-estimate";
import { convertToBRL } from "../domain/currency-converter";
import { TrackingAuditService } from "./tracking-audit.service";
import { TrackingFxService } from "./tracking-fx.service";
import { CreateTrackingJobDto, UpdateTrackingJobDto } from "./dto/tracking-job.dto";

@Injectable()
export class TrackingJobsService {
  constructor(
    private readonly jobs: TrackingJobRepository,
    private readonly audit: TrackingAuditService,
    private readonly fx: TrackingFxService,
  ) {}

  async findAll(userId: string) {
    const jobs = await this.jobs.findAllByUser(userId);
    const usdToBrlRate = jobs.some((j) => j.currency === "USD") ? await this.fx.getUsdToBrlRate() : null;
    return jobs.map((job) => this.buildView(job, usdToBrlRate));
  }

  async findOne(userId: string, id: string) {
    const job = await this.getOwned(userId, id);
    const usdToBrlRate = job.currency === "USD" ? await this.fx.getUsdToBrlRate() : null;
    return this.buildView(job, usdToBrlRate);
  }

  async create(userId: string, dto: CreateTrackingJobDto) {
    const job = await this.jobs.create({
      userId,
      name: dto.name,
      company: dto.company,
      client: dto.client,
      monthlyValue: dto.monthlyValue,
      currency: dto.currency,
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

  /** Attaches the BRL-converted monthly value (when currency is USD, using today's rate) and the
   *  estimated hourly rate derived from it — so "quanto vale minha hora"/"próximo salário
   *  aproximado" is always shown in BRL regardless of which currency the job is denominated in. */
  private buildView(job: { monthlyValue: unknown; currency: "BRL" | "USD"; expectedHoursPerDay: number; weekdays: number[] }, usdToBrlRate: number | null) {
    const monthlyValueBRL = convertToBRL(Number(job.monthlyValue), job.currency, usdToBrlRate);
    const estimatedHourlyRate =
      monthlyValueBRL !== null
        ? estimateJobHourlyRate({ monthlyValue: monthlyValueBRL, expectedHoursPerDay: job.expectedHoursPerDay, weekdays: job.weekdays })
        : null;
    return {
      ...job,
      monthlyValueBRL,
      fxRate: job.currency === "USD" ? usdToBrlRate : null,
      estimatedHourlyRate,
    };
  }

  private async getOwned(userId: string, id: string) {
    const job = await this.jobs.findById(id);
    if (!job) throw new NotFoundException("Trabalho fixo não encontrado.");
    if (job.userId !== userId) throw new ForbiddenException();
    return job;
  }
}
