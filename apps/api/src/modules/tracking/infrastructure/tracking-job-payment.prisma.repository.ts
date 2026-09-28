import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreateTrackingJobPaymentData, TrackingJobPaymentRepository } from "../domain/tracking-job-payment.repository";

@Injectable()
export class TrackingJobPaymentPrismaRepository extends TrackingJobPaymentRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findForJobsAndMonth(jobIds: string[], referenceYear: number, referenceMonth: number) {
    if (jobIds.length === 0) return new Map<string, number>();
    const rows = await this.prisma.trackingJobPayment.findMany({
      where: { jobId: { in: jobIds }, referenceYear, referenceMonth },
    });
    return new Map(rows.map((r) => [r.jobId, Number(r.amountBRL)]));
  }

  findByJobAndMonth(jobId: string, referenceYear: number, referenceMonth: number) {
    return this.prisma.trackingJobPayment.findUnique({
      where: { jobId_referenceYear_referenceMonth: { jobId, referenceYear, referenceMonth } },
    });
  }

  upsert(data: CreateTrackingJobPaymentData) {
    return this.prisma.trackingJobPayment.upsert({
      where: { jobId_referenceYear_referenceMonth: { jobId: data.jobId, referenceYear: data.referenceYear, referenceMonth: data.referenceMonth } },
      create: {
        userId: data.userId,
        jobId: data.jobId,
        referenceYear: data.referenceYear,
        referenceMonth: data.referenceMonth,
        amount: data.amount,
        currency: data.currency,
        exchangeRate: data.exchangeRate,
        amountBRL: data.amountBRL,
      },
      update: {
        amount: data.amount,
        currency: data.currency,
        exchangeRate: data.exchangeRate,
        amountBRL: data.amountBRL,
        confirmedAt: new Date(),
      },
    });
  }

  findAllByJob(jobId: string) {
    return this.prisma.trackingJobPayment.findMany({ where: { jobId }, orderBy: [{ referenceYear: "desc" }, { referenceMonth: "desc" }] });
  }
}
