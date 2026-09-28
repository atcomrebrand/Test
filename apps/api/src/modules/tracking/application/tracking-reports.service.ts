import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { computeSessionTime } from "../domain/session-time-calculator";
import { estimateJobHourlyRate } from "../domain/job-hourly-estimate";
import { computeHourlyRateBreakdown } from "../domain/hourly-rate-calculator";
import { computeFreelanceHourlyRate } from "../domain/freelance-hourly-rate";
import { convertToBRL } from "../domain/currency-converter";
import { TrackingFxService } from "./tracking-fx.service";

const CATEGORY_LABELS: Record<string, string> = {
  FIXO: "Trabalhos fixos",
  FREELA: "Projetos extras",
  OUTRO: "Outras entradas",
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sumBy<T>(items: T[], fn: (item: T) => number): number {
  return items.reduce((total, item) => total + fn(item), 0);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Same enrichment approach as TrackingDashboardService (computeSessionTime + hourlyRate over raw
 * sessions), but parametrized by an arbitrary [from, to) range instead of a fixed "this month" —
 * powers the "hoje/semana/mês/ano/personalizado" report filters. Trabalho fixo and freelance are
 * both TrackingJob+TrackingSession — freelance's rate needs ALL-time hours (not just this range)
 * for totalAgreedValue÷horas to be accurate, so it's fetched separately from the range-filtered query.
 */
@Injectable()
export class TrackingReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: TrackingFxService,
  ) {}

  async generate(userId: string, from: Date, to: Date) {
    const [rawSessions, incomes] = await Promise.all([
      this.prisma.trackingSession.findMany({
        where: { userId, status: "COMPLETED", checkIn: { gte: from, lt: to } },
        include: { pauses: true, job: true },
        orderBy: { checkIn: "asc" },
      }),
      this.prisma.trackingIncome.findMany({ where: { userId, deletedAt: null, date: { gte: from, lt: to } } }),
    ]);

    const usdToBrlRate = rawSessions.some((s) => s.job.currency === "USD") ? await this.fx.getUsdToBrlRate() : null;

    const freelanceJobIds = [...new Set(rawSessions.filter((s) => s.job.type === "FREELANCE").map((s) => s.jobId))];
    const freelanceRateByJob = await this.computeFreelanceRates(freelanceJobIds, rawSessions, usdToBrlRate);

    const sessions = rawSessions.map((s) => {
      const time = computeSessionTime({ checkIn: s.checkIn, checkOut: s.checkOut, pauses: s.pauses });
      let hourlyRate: number;
      if (s.job.type === "FREELANCE") {
        hourlyRate = freelanceRateByJob.get(s.jobId) ?? 0;
      } else {
        const monthlyValueBRL = convertToBRL(Number(s.job.monthlyValue), s.job.currency, usdToBrlRate);
        hourlyRate =
          monthlyValueBRL !== null
            ? estimateJobHourlyRate({ monthlyValue: monthlyValueBRL, expectedHoursPerDay: s.job.expectedHoursPerDay, weekdays: s.job.weekdays })
            : 0;
      }
      const value = round2((time.netSeconds / 3600) * hourlyRate);
      return {
        jobId: s.jobId,
        jobType: s.job.type,
        checkIn: s.checkIn,
        netSeconds: time.netSeconds,
        value,
        clientLabel: s.job.client ?? s.job.company,
        company: s.job.company,
      };
    });

    const fixoSessions = sessions.filter((s) => s.jobType === "FIXO");
    const freelanceSessions = sessions.filter((s) => s.jobType === "FREELANCE");

    const fixedJobsRevenue = sumBy(fixoSessions, (s) => s.value);
    const freelanceRevenue = sumBy(freelanceSessions, (s) => s.value);
    const freelanceHours = sumBy(freelanceSessions, (s) => s.netSeconds) / 3600;
    const otherIncome = sumBy(incomes, (i) => Number(i.amount));

    const breakdown = computeHourlyRateBreakdown({
      fixedJobsRevenue,
      fixedJobsSeconds: sumBy(fixoSessions, (s) => s.netSeconds),
      freelanceRevenue,
      freelanceHours,
      otherIncome,
    });

    const byDayHours = new Map<string, number>();
    const byDayRevenue = new Map<string, number>();
    for (const s of sessions) {
      const key = dayKey(s.checkIn);
      byDayHours.set(key, (byDayHours.get(key) ?? 0) + s.netSeconds / 3600);
      byDayRevenue.set(key, (byDayRevenue.get(key) ?? 0) + s.value);
    }

    const daysWorked = byDayHours.size;
    const maxDailyHours = byDayHours.size > 0 ? round2(Math.max(...byDayHours.values())) : 0;
    const maxDailyRevenue = byDayRevenue.size > 0 ? round2(Math.max(...byDayRevenue.values())) : 0;
    const averageDailyHours = daysWorked > 0 ? round2(breakdown.totalHours / daysWorked) : null;

    const byClient = new Map<string, number>();
    const byCompany = new Map<string, number>();
    for (const s of sessions) {
      byClient.set(s.clientLabel, (byClient.get(s.clientLabel) ?? 0) + s.value);
      byCompany.set(s.company, (byCompany.get(s.company) ?? 0) + s.value);
    }

    const toSortedList = (map: Map<string, number>, keyName: string) =>
      Array.from(map.entries())
        .map(([k, v]) => ({ [keyName]: k, amount: round2(v) }))
        .sort((a, b) => b.amount - a.amount);

    return {
      totalRevenue: round2(breakdown.totalRevenue),
      hoursWorked: round2(breakdown.totalHours),
      averageHourlyRate: breakdown.averageHourlyRate,
      projectsCount: new Set(freelanceSessions.map((s) => s.jobId)).size,
      otherIncomeTotal: round2(otherIncome),
      daysWorked,
      maxDailyRevenue,
      maxDailyHours,
      averageDailyHours,
      revenueByCategory: (
        [
          { category: "FIXO", amount: round2(fixedJobsRevenue) },
          { category: "FREELA", amount: round2(freelanceRevenue) },
          { category: "OUTRO", amount: round2(otherIncome) },
        ] as const
      )
        .filter((c) => c.amount > 0)
        .map((c) => ({ ...c, label: CATEGORY_LABELS[c.category] })),
      revenueByClient: toSortedList(byClient, "client"),
      revenueByCompany: toSortedList(byCompany, "company"),
    };
  }

  /** Freelance's valor/hora always needs ALL-time hours (not just this report's range) — fetches
   *  the extra completed sessions outside the range separately, then combines with the in-range
   *  ones already loaded, so a "semana"/"hoje" report still divides by the true cumulative total. */
  private async computeFreelanceRates(
    freelanceJobIds: string[],
    inRangeSessions: { jobId: string; checkIn: Date; checkOut: Date | null; pauses: { pausedAt: Date; resumedAt: Date | null }[]; job: { type: string; totalAgreedValue: unknown; currency: "BRL" | "USD" } }[],
    usdToBrlRate: number | null,
  ) {
    const rates = new Map<string, number>();
    if (freelanceJobIds.length === 0) return rates;

    const allTimeSessions = await this.prisma.trackingSession.findMany({
      where: { jobId: { in: freelanceJobIds }, status: "COMPLETED" },
      include: { pauses: true },
    });

    const secondsByJob = new Map<string, number>();
    for (const s of allTimeSessions) {
      const time = computeSessionTime({ checkIn: s.checkIn, checkOut: s.checkOut, pauses: s.pauses });
      secondsByJob.set(s.jobId, (secondsByJob.get(s.jobId) ?? 0) + time.netSeconds);
    }

    const jobById = new Map(inRangeSessions.map((s) => [s.jobId, s.job]));
    for (const jobId of freelanceJobIds) {
      const job = jobById.get(jobId);
      if (!job || job.totalAgreedValue === null) continue;
      const totalAgreedValueBRL = convertToBRL(Number(job.totalAgreedValue), job.currency, usdToBrlRate);
      const rate = totalAgreedValueBRL !== null ? computeFreelanceHourlyRate({ totalAgreedValueBRL, totalNetSeconds: secondsByJob.get(jobId) ?? 0 }) : null;
      rates.set(jobId, rate ?? 0);
    }

    return rates;
  }
}
