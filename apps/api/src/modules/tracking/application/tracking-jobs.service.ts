import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { TrackingJobRepository } from "../domain/tracking-job.repository";
import { TrackingSessionRepository } from "../domain/tracking-session.repository";
import { estimateJobHourlyRate } from "../domain/job-hourly-estimate";
import { convertToBRL } from "../domain/currency-converter";
import { TrackingAuditService } from "./tracking-audit.service";
import { TrackingFxService } from "./tracking-fx.service";
import { computeFreelanceRates } from "./freelance-rate.helper";
import { CreateTrackingJobDto, UpdateTrackingJobDto } from "./dto/tracking-job.dto";

@Injectable()
export class TrackingJobsService {
  constructor(
    private readonly jobs: TrackingJobRepository,
    private readonly sessions: TrackingSessionRepository,
    private readonly audit: TrackingAuditService,
    private readonly fx: TrackingFxService,
  ) {}

  async findAll(userId: string) {
    const jobs = await this.jobs.findAllByUser(userId);
    const usdToBrlRate = jobs.some((j) => j.currency === "USD") ? await this.fx.getUsdToBrlRate() : null;
    const freelanceRates = await computeFreelanceRates(this.sessions, jobs, usdToBrlRate);
    return jobs.map((job) => this.buildView(job, usdToBrlRate, freelanceRates.get(job.id) ?? null));
  }

  async findOne(userId: string, id: string) {
    const job = await this.getOwned(userId, id);
    const usdToBrlRate = job.currency === "USD" ? await this.fx.getUsdToBrlRate() : null;
    const freelanceRates = await computeFreelanceRates(this.sessions, [job], usdToBrlRate);
    return this.buildView(job, usdToBrlRate, freelanceRates.get(job.id) ?? null);
  }

  async create(userId: string, dto: CreateTrackingJobDto) {
    const type = dto.type ?? "FIXO";
    const company = this.resolveCompany(type, dto.company, dto.client);

    if (type === "FIXO" && !dto.monthlyValue) throw new BadRequestException("Informe o valor mensal do trabalho fixo.");
    if (type === "FREELANCE" && !dto.totalAgreedValue) throw new BadRequestException("Informe o valor combinado do freelance.");

    const job = await this.jobs.create({
      userId,
      type,
      name: dto.name,
      company,
      client: dto.client,
      monthlyValue: type === "FIXO" ? dto.monthlyValue : undefined,
      totalAgreedValue: type === "FREELANCE" ? dto.totalAgreedValue : undefined,
      currency: dto.currency,
      expectedHoursPerDay: dto.expectedHoursPerDay,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      paymentMethod: dto.paymentMethod,
      paymentDay: type === "FIXO" ? dto.paymentDay : undefined,
      color: dto.color,
      weekdays: dto.weekdays,
      daysOff: dto.daysOff,
      tracksPlacement: dto.tracksPlacement,
      expectedStartTime: dto.expectedStartTime,
      expectedEndTime: dto.expectedEndTime,
      notes: dto.notes,
    });
    await this.audit.log(userId, "TrackingJob", job.id, "CREATE", null, job);
    return job;
  }

  async update(userId: string, id: string, dto: UpdateTrackingJobDto) {
    const before = await this.getOwned(userId, id);
    const type = dto.type ?? before.type;
    const data: Record<string, unknown> = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    if ((dto.company !== undefined || dto.type !== undefined) && type === "FREELANCE") {
      data.company = this.resolveCompany(type, dto.company ?? before.company, dto.client ?? before.client ?? undefined);
    }
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

  /** FREELANCE doesn't require a separate "empresa" field the way a trabalho fixo does — falls
   *  back to the client name, or "Freelance" as a last resort. FIXO still requires it explicitly. */
  private resolveCompany(type: "FIXO" | "FREELANCE", company: string | undefined, client: string | undefined): string {
    if (type === "FREELANCE") return company || client || "Freelance";
    if (!company) throw new BadRequestException("Informe a empresa.");
    return company;
  }

  /** Attaches the BRL-converted value (when currency is USD, using today's rate) and the estimated
   *  hourly rate — FIXO derives it from monthlyValue+jornada (estimateJobHourlyRate); FREELANCE
   *  derives it from totalAgreedValue ÷ horas cronometradas até agora (computeFreelanceRates),
   *  passed in already computed since it needs an async DB lookup across all this job's sessions. */
  private buildView(
    job: {
      type: string;
      monthlyValue: unknown;
      totalAgreedValue: unknown;
      currency: "BRL" | "USD";
      expectedHoursPerDay: number;
      weekdays: number[];
    },
    usdToBrlRate: number | null,
    freelanceRate: number | null,
  ) {
    const fxRate = job.currency === "USD" ? usdToBrlRate : null;

    if (job.type === "FREELANCE") {
      const totalAgreedValueBRL = job.totalAgreedValue !== null ? convertToBRL(Number(job.totalAgreedValue), job.currency, usdToBrlRate) : null;
      return { ...job, monthlyValueBRL: null, totalAgreedValueBRL, fxRate, estimatedHourlyRate: freelanceRate };
    }

    const monthlyValueBRL = job.monthlyValue !== null ? convertToBRL(Number(job.monthlyValue), job.currency, usdToBrlRate) : null;
    const estimatedHourlyRate =
      monthlyValueBRL !== null
        ? estimateJobHourlyRate({ monthlyValue: monthlyValueBRL, expectedHoursPerDay: job.expectedHoursPerDay, weekdays: job.weekdays })
        : null;
    return { ...job, monthlyValueBRL, totalAgreedValueBRL: null, fxRate, estimatedHourlyRate };
  }

  private async getOwned(userId: string, id: string) {
    const job = await this.jobs.findById(id);
    if (!job) throw new NotFoundException("Trabalho fixo não encontrado.");
    if (job.userId !== userId) throw new ForbiddenException();
    return job;
  }
}
