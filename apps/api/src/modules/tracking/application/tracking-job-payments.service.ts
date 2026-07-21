import { ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { TrackingJobRepository } from "../domain/tracking-job.repository";
import { TrackingJobPaymentRepository } from "../domain/tracking-job-payment.repository";
import { convertToBRL } from "../domain/currency-converter";
import { TrackingFxService } from "./tracking-fx.service";
import { TrackingAuditService } from "./tracking-audit.service";
import { ConfirmTrackingJobPaymentDto } from "./dto/tracking-job-payment.dto";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * "Hoje é dia de pagamento de X — quanto você recebeu esse mês?" A trabalho fixo's real payment
 * can diverge from the hours-based estimate (a salaried job pays a flat amount regardless of hours
 * worked), so this manual monthly confirmation is the only trustworthy source for "quanto recebi de
 * verdade" — it then overrides the estimate everywhere the dashboard/relatórios show fixed-job
 * revenue for that job/month (see computeFixedJobRevenue).
 */
@Injectable()
export class TrackingJobPaymentsService {
  constructor(
    private readonly jobs: TrackingJobRepository,
    private readonly payments: TrackingJobPaymentRepository,
    private readonly fx: TrackingFxService,
    private readonly audit: TrackingAuditService,
  ) {}

  /** Trabalhos fixos ativos cujo dia de pagamento já chegou este mês e ainda não têm confirmação. */
  async pending(userId: string) {
    const now = new Date();
    const referenceYear = now.getFullYear();
    const referenceMonth = now.getMonth() + 1;
    const today = now.getDate();

    const jobs = (await this.jobs.findAllByUser(userId)).filter((j) => j.active && j.paymentDay !== null && j.paymentDay <= today);
    if (jobs.length === 0) return [];

    const confirmed = await this.payments.findForJobsAndMonth(
      jobs.map((j) => j.id),
      referenceYear,
      referenceMonth,
    );

    return jobs
      .filter((j) => !confirmed.has(j.id))
      .map((j) => ({
        jobId: j.id,
        jobName: j.name,
        company: j.company,
        currency: j.currency,
        monthlyValue: Number(j.monthlyValue),
        referenceYear,
        referenceMonth,
      }));
  }

  async confirm(userId: string, jobId: string, dto: ConfirmTrackingJobPaymentDto) {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new NotFoundException("Trabalho fixo não encontrado.");
    if (job.userId !== userId) throw new ForbiddenException();

    const now = new Date();
    const referenceYear = now.getFullYear();
    const referenceMonth = now.getMonth() + 1;

    let exchangeRate: number | null = null;
    let amountBRL: number;
    if (job.currency === "USD") {
      const rate = await this.fx.getUsdToBrlRate();
      if (rate === null) {
        throw new ServiceUnavailableException("Não foi possível obter a cotação do dólar agora. Tente novamente em instantes.");
      }
      exchangeRate = rate;
      const converted = convertToBRL(dto.amount, "USD", rate);
      amountBRL = converted ?? dto.amount;
    } else {
      amountBRL = round2(dto.amount);
    }

    const before = await this.payments.findByJobAndMonth(jobId, referenceYear, referenceMonth);
    const saved = await this.payments.upsert({
      userId,
      jobId,
      referenceYear,
      referenceMonth,
      amount: dto.amount,
      currency: job.currency,
      exchangeRate,
      amountBRL,
    });

    await this.audit.log(
      userId,
      "TrackingJobPayment",
      saved.id,
      before ? "UPDATE" : "CREATE",
      before ? { amount: Number(before.amount), amountBRL: Number(before.amountBRL) } : null,
      { amount: dto.amount, amountBRL },
    );

    return { ...saved, jobName: job.name };
  }

  async history(userId: string, jobId: string) {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new NotFoundException("Trabalho fixo não encontrado.");
    if (job.userId !== userId) throw new ForbiddenException();
    return this.payments.findAllByJob(jobId);
  }
}
