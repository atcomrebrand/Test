import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { computeSessionTime } from "../domain/session-time-calculator";
import { estimateJobHourlyRate } from "../domain/job-hourly-estimate";
import { computeHourlyRateBreakdown } from "../domain/hourly-rate-calculator";
import { generateInsights } from "../domain/insights-generator";
import { LONG_SESSION_HOURS } from "./tracking-sessions.service";

const HOURS_BY_DAY_WINDOW = 14;
const REVENUE_BY_CLIENT_LIMIT = 5;
const PRODUCTIVITY_WINDOW_HOURS = 3;

const CATEGORY_LABELS: Record<string, string> = {
  FIXO: "Trabalhos fixos",
  FREELA: "Projetos extras",
  OUTRO: "Outras entradas",
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sumBy<T>(items: T[], fn: (item: T) => number): number {
  return items.reduce((total, item) => total + fn(item), 0);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface EnrichedSession {
  checkIn: Date;
  netSeconds: number;
  value: number;
  clientLabel: string;
}

/**
 * All-in-one dashboard aggregation, mirroring InvestmentsDashboardService's shape: a single
 * `summary(userId)` that fans out to the raw tables, enriches sessions with the same
 * computeSessionTime/estimateJobHourlyRate formulas the timer itself uses (so a session's "value"
 * here always matches what Modo Foco showed live), then reduces everything into the stat
 * tiles/charts/insights the dashboard page needs.
 */
@Injectable()
export class TrackingDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string) {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = new Date(todayStart.getTime() + 86_400_000);
    const monthStart = startOfMonth(now);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = monthStart;

    const [jobs, rawSessions, projects, incomes] = await Promise.all([
      this.prisma.trackingJob.findMany({ where: { userId, deletedAt: null } }),
      this.prisma.trackingSession.findMany({
        where: { userId, status: "COMPLETED" },
        include: { pauses: true, job: true },
        orderBy: { checkIn: "asc" },
      }),
      this.prisma.trackingProject.findMany({ where: { userId, deletedAt: null } }),
      this.prisma.trackingIncome.findMany({ where: { userId, deletedAt: null } }),
    ]);

    const sessions: EnrichedSession[] = rawSessions.map((s) => {
      const time = computeSessionTime({ checkIn: s.checkIn, checkOut: s.checkOut, pauses: s.pauses });
      const hourlyRate = estimateJobHourlyRate({
        monthlyValue: Number(s.job.monthlyValue),
        expectedHoursPerDay: s.job.expectedHoursPerDay,
        weekdays: s.job.weekdays,
      });
      const value = round2((time.netSeconds / 3600) * hourlyRate);
      return { checkIn: s.checkIn, netSeconds: time.netSeconds, value, clientLabel: s.job.client ?? s.job.company };
    });

    const inRange = (date: Date, from: Date, to: Date) => date >= from && date < to;

    const sessionsToday = sessions.filter((s) => inRange(s.checkIn, todayStart, todayEnd));
    const sessionsThisMonth = sessions.filter((s) => inRange(s.checkIn, monthStart, monthEnd));
    const sessionsPrevMonth = sessions.filter((s) => inRange(s.checkIn, prevMonthStart, prevMonthEnd));

    const hoursToday = sumBy(sessionsToday, (s) => s.netSeconds) / 3600;
    const hoursThisMonth = sumBy(sessionsThisMonth, (s) => s.netSeconds) / 3600;
    const hoursPrevMonth = sumBy(sessionsPrevMonth, (s) => s.netSeconds) / 3600;

    const fixedJobsRevenue = sumBy(sessionsThisMonth, (s) => s.value);
    const fixedJobsRevenuePrevMonth = sumBy(sessionsPrevMonth, (s) => s.value);

    const projectsThisMonth = projects.filter((p) => inRange(p.date, monthStart, monthEnd));
    const projectsPrevMonth = projects.filter((p) => inRange(p.date, prevMonthStart, prevMonthEnd));
    const freelanceRevenue = sumBy(projectsThisMonth, (p) => Number(p.amountReceived));
    const freelanceRevenuePrevMonth = sumBy(projectsPrevMonth, (p) => Number(p.amountReceived));
    const freelanceHoursThisMonth = sumBy(projectsThisMonth, (p) => Number(p.hoursSpent));

    const incomesThisMonth = incomes.filter((i) => inRange(i.date, monthStart, monthEnd));
    const incomesPrevMonth = incomes.filter((i) => inRange(i.date, prevMonthStart, prevMonthEnd));
    const otherIncome = sumBy(incomesThisMonth, (i) => Number(i.amount));
    const otherIncomePrevMonth = sumBy(incomesPrevMonth, (i) => Number(i.amount));

    const totalRevenue = fixedJobsRevenue + freelanceRevenue + otherIncome;
    const totalRevenuePrevMonth = fixedJobsRevenuePrevMonth + freelanceRevenuePrevMonth + otherIncomePrevMonth;

    const breakdown = computeHourlyRateBreakdown({
      fixedJobsRevenue,
      fixedJobsSeconds: sumBy(sessionsThisMonth, (s) => s.netSeconds),
      freelanceRevenue,
      freelanceHours: freelanceHoursThisMonth,
      otherIncome,
    });

    const prevBreakdown = computeHourlyRateBreakdown({
      fixedJobsRevenue: fixedJobsRevenuePrevMonth,
      fixedJobsSeconds: sumBy(sessionsPrevMonth, (s) => s.netSeconds),
      freelanceRevenue: freelanceRevenuePrevMonth,
      freelanceHours: sumBy(projectsPrevMonth, (p) => Number(p.hoursSpent)),
      otherIncome: otherIncomePrevMonth,
    });

    const daysElapsedInMonth = now.getDate();
    const workedDayKeys = new Set(sessionsThisMonth.map((s) => dayKey(s.checkIn)));
    const daysWorked = workedDayKeys.size;
    const daysWithoutWork = Math.max(0, daysElapsedInMonth - daysWorked);
    const averageDailyHours = daysWorked > 0 ? hoursThisMonth / daysWorked : null;

    const nextPayment = this.computeNextPayment(jobs, now);
    const hoursByDay = this.buildHoursByDay(sessions, now);
    const revenueByClient = this.buildRevenueByClient(sessionsThisMonth, projectsThisMonth);

    const revenueByCategory = (
      [
        { category: "FIXO", amount: round2(fixedJobsRevenue) },
        { category: "FREELA", amount: round2(freelanceRevenue) },
        { category: "OUTRO", amount: round2(otherIncome) },
      ] as const
    )
      .filter((c) => c.amount > 0)
      .map((c) => ({ ...c, label: CATEGORY_LABELS[c.category] }));

    const financialGrowthPercent = totalRevenuePrevMonth > 0 ? round2(((totalRevenue - totalRevenuePrevMonth) / totalRevenuePrevMonth) * 100) : null;
    const productivityGrowthPercent = hoursPrevMonth > 0 ? round2(((hoursThisMonth - hoursPrevMonth) / hoursPrevMonth) * 100) : null;

    const topClient = revenueByClient[0] ? { name: revenueByClient[0].client, revenue: revenueByClient[0].amount } : null;
    const forgottenCheckoutsCount = await this.countForgottenCheckouts(userId, now);
    const lastSession = sessions[sessions.length - 1] ?? null;
    const daysSinceLastSession = lastSession ? Math.floor((now.getTime() - lastSession.checkIn.getTime()) / 86_400_000) : null;
    const isBestMonthEver = this.isBestMonthEver(sessions, projects, incomes, now);
    const bestProductivityWindow = this.computeBestProductivityWindow(sessions);

    const insights = generateInsights({
      currentPeriodHours: round2(hoursThisMonth),
      previousPeriodHours: round2(hoursPrevMonth),
      currentPeriodHourlyRate: breakdown.averageHourlyRate,
      previousPeriodHourlyRate: prevBreakdown.averageHourlyRate,
      topClient,
      freelanceRevenueThisMonth: round2(freelanceRevenue),
      averageDailyHours: averageDailyHours !== null ? round2(averageDailyHours) : null,
      forgottenCheckoutsCount,
      daysSinceLastSession,
      isBestMonthEver,
      bestProductivityWindow,
    });

    return {
      hoursToday: round2(hoursToday),
      hoursThisMonth: round2(hoursThisMonth),
      fixedJobsRevenue: round2(fixedJobsRevenue),
      freelanceRevenue: round2(freelanceRevenue),
      otherIncome: round2(otherIncome),
      totalRevenue: round2(totalRevenue),
      averageHourlyRate: breakdown.averageHourlyRate,
      averageDailyHours: averageDailyHours !== null ? round2(averageDailyHours) : null,
      daysWorked,
      daysWithoutWork,
      nextPayment,
      previousMonth: { hoursThisMonth: round2(hoursPrevMonth), totalRevenue: round2(totalRevenuePrevMonth) },
      financialGrowthPercent,
      productivityGrowthPercent,
      hoursByDay,
      revenueByCategory,
      revenueByClient,
      insights,
    };
  }

  private computeNextPayment(jobs: { name: string; company: string; paymentDay: number | null; active: boolean }[], now: Date) {
    const candidates = jobs
      .filter((j) => j.active && j.paymentDay)
      .map((j) => {
        const day = j.paymentDay!;
        const thisMonthDate = new Date(now.getFullYear(), now.getMonth(), day, 12);
        const date = thisMonthDate >= now ? thisMonthDate : new Date(now.getFullYear(), now.getMonth() + 1, day, 12);
        return { jobName: j.name, company: j.company, date, estimatedAmount: 0 };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (candidates.length === 0) return null;
    const next = candidates[0];
    return { jobName: next.jobName, company: next.company, date: next.date, estimatedAmount: next.estimatedAmount };
  }

  private buildHoursByDay(sessions: EnrichedSession[], now: Date) {
    const days: { date: string; hours: number }[] = [];
    for (let i = HOURS_BY_DAY_WINDOW - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      days.push({ date: dayKey(d), hours: 0 });
    }
    const byKey = new Map(days.map((d) => [d.date, d]));
    for (const s of sessions) {
      const key = dayKey(s.checkIn);
      const entry = byKey.get(key);
      if (entry) entry.hours = round2(entry.hours + s.netSeconds / 3600);
    }
    return days;
  }

  private buildRevenueByClient(
    sessionsThisMonth: EnrichedSession[],
    projectsThisMonth: { client: string | null; name: string; amountReceived: unknown }[],
  ) {
    const totals = new Map<string, number>();
    for (const s of sessionsThisMonth) {
      totals.set(s.clientLabel, (totals.get(s.clientLabel) ?? 0) + s.value);
    }
    for (const p of projectsThisMonth) {
      const label = p.client ?? p.name;
      totals.set(label, (totals.get(label) ?? 0) + Number(p.amountReceived));
    }
    return Array.from(totals.entries())
      .map(([client, amount]) => ({ client, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, REVENUE_BY_CLIENT_LIMIT);
  }

  private async countForgottenCheckouts(userId: string, now: Date) {
    const cutoff = new Date(now.getTime() - LONG_SESSION_HOURS * 3600 * 1000);
    return this.prisma.trackingSession.count({
      where: { userId, status: { in: ["RUNNING", "PAUSED"] }, checkIn: { lt: cutoff } },
    });
  }

  private isBestMonthEver(
    sessions: EnrichedSession[],
    projects: { date: Date; amountReceived: unknown }[],
    incomes: { date: Date; amount: unknown }[],
    now: Date,
  ) {
    const totalsByMonth = new Map<string, number>();
    const add = (date: Date, amount: number) => {
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0) + amount);
    };
    for (const s of sessions) add(s.checkIn, s.value);
    for (const p of projects) add(p.date, Number(p.amountReceived));
    for (const i of incomes) add(i.date, Number(i.amount));

    const currentKey = `${now.getFullYear()}-${now.getMonth()}`;
    const currentTotal = totalsByMonth.get(currentKey) ?? 0;
    if (currentTotal <= 0) return false;

    for (const [key, total] of totalsByMonth) {
      if (key !== currentKey && total >= currentTotal) return false;
    }
    return true;
  }

  private computeBestProductivityWindow(sessions: EnrichedSession[]) {
    if (sessions.length === 0) return null;
    const byHour = new Array(24).fill(0);
    for (const s of sessions) {
      byHour[s.checkIn.getHours()] += s.netSeconds;
    }

    let bestStart = 0;
    let bestTotal = -1;
    for (let start = 0; start <= 24 - PRODUCTIVITY_WINDOW_HOURS; start++) {
      const total = byHour.slice(start, start + PRODUCTIVITY_WINDOW_HOURS).reduce((a, b) => a + b, 0);
      if (total > bestTotal) {
        bestTotal = total;
        bestStart = start;
      }
    }

    if (bestTotal <= 0) return null;
    return { startHour: bestStart, endHour: bestStart + PRODUCTIVITY_WINDOW_HOURS };
  }
}
