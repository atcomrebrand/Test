import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { computeSessionTime } from "../domain/session-time-calculator";
import { estimateJobHourlyRate } from "../domain/job-hourly-estimate";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function weekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return dayKey(d);
}

function topEntries(map: Map<string, number>, limit: number) {
  return Array.from(map.entries())
    .map(([key, amount]) => ({ name: key, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

/**
 * All-time records/rankings, computed once over the entire session/project/income history — same
 * enrichment approach as the dashboard (computeSessionTime + estimateJobHourlyRate) so a session's
 * value always matches what it shows everywhere else.
 */
@Injectable()
export class TrackingStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string) {
    const [rawSessions, projects, incomes] = await Promise.all([
      this.prisma.trackingSession.findMany({
        where: { userId, status: "COMPLETED" },
        include: { pauses: true, job: true },
        orderBy: { checkIn: "asc" },
      }),
      this.prisma.trackingProject.findMany({ where: { userId, deletedAt: null } }),
      this.prisma.trackingIncome.findMany({ where: { userId, deletedAt: null } }),
    ]);

    const sessions = rawSessions.map((s) => {
      const time = computeSessionTime({ checkIn: s.checkIn, checkOut: s.checkOut, pauses: s.pauses });
      const hourlyRate = estimateJobHourlyRate({
        monthlyValue: Number(s.job.monthlyValue),
        expectedHoursPerDay: s.job.expectedHoursPerDay,
        weekdays: s.job.weekdays,
      });
      const value = round2((time.netSeconds / 3600) * hourlyRate);
      return {
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        netSeconds: time.netSeconds,
        value,
        clientLabel: s.job.client ?? s.job.company,
        company: s.job.company,
      };
    });

    const totalHoursAllTime = round2(sessions.reduce((sum, s) => sum + s.netSeconds, 0) / 3600);
    const sessionsRevenue = sessions.reduce((sum, s) => sum + s.value, 0);
    const projectsRevenue = projects.reduce((sum, p) => sum + Number(p.amountReceived), 0);
    const incomesRevenue = incomes.reduce((sum, i) => sum + Number(i.amount), 0);
    const totalRevenueAllTime = round2(sessionsRevenue + projectsRevenue + incomesRevenue);
    const totalHoursForRate = totalHoursAllTime + projects.reduce((sum, p) => sum + Number(p.hoursSpent), 0);
    const averageHourlyRateAllTime = totalHoursForRate > 0 ? round2(totalRevenueAllTime / totalHoursForRate) : null;

    const revenueByMonth = new Map<string, number>();
    const addToMonth = (date: Date, amount: number) => {
      const key = monthKey(date);
      revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + amount);
    };
    for (const s of sessions) addToMonth(s.checkIn, s.value);
    for (const p of projects) addToMonth(p.date, Number(p.amountReceived));
    for (const i of incomes) addToMonth(i.date, Number(i.amount));

    const monthEntries = Array.from(revenueByMonth.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const bestMonth = monthEntries.length > 0 ? monthEntries.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
    const worstMonth = monthEntries.length > 0 ? monthEntries.reduce((a, b) => (b[1] < a[1] ? b : a)) : null;

    const biggestProject =
      projects.length > 0
        ? projects.reduce((a, b) => (Number(b.amountReceived) > Number(a.amountReceived) ? b : a))
        : null;
    const biggestOtherIncome = incomes.length > 0 ? incomes.reduce((a, b) => (Number(b.amount) > Number(a.amount) ? b : a)) : null;

    const workedDayKeys = new Set(sessions.map((s) => dayKey(s.checkIn)));
    const checkInsCount = sessions.length;
    const averageDailyHours = workedDayKeys.size > 0 ? round2(totalHoursAllTime / workedDayKeys.size) : null;
    const longestStreak = this.computeLongestStreak(workedDayKeys);

    const clientRanking = topEntries(this.groupSum(sessions, (s) => s.clientLabel, (s) => s.value), 5);
    const companyRanking = topEntries(this.groupSum(sessions, (s) => s.company, (s) => s.value), 5);
    const projectRanking = topEntries(
      new Map(projects.map((p) => [p.name, Number(p.amountReceived)] as const)),
      5,
    );

    const averageStartHour = this.averageHour(sessions.map((s) => s.checkIn));
    const averageEndHour = this.averageHour(sessions.filter((s) => s.checkOut).map((s) => s.checkOut!));

    const productivityByWeek = this.groupSecondsToHours(sessions, (s) => weekKey(s.checkIn), 8);
    const productivityByMonth = this.groupSecondsToHours(sessions, (s) => monthKey(s.checkIn), 12);

    return {
      totalHoursAllTime,
      totalRevenueAllTime,
      averageHourlyRateAllTime,
      bestMonth: bestMonth ? { month: bestMonth[0], amount: round2(bestMonth[1]) } : null,
      worstMonth: worstMonth ? { month: worstMonth[0], amount: round2(worstMonth[1]) } : null,
      biggestProject: biggestProject ? { name: biggestProject.name, amount: Number(biggestProject.amountReceived) } : null,
      biggestOtherIncome: biggestOtherIncome ? { name: biggestOtherIncome.name, amount: Number(biggestOtherIncome.amount) } : null,
      checkInsCount,
      averageDailyHours,
      longestStreak,
      clientRanking,
      companyRanking,
      projectRanking,
      averageStartHour,
      averageEndHour,
      productivityByWeek,
      productivityByMonth,
    };
  }

  private groupSum<T>(items: T[], keyFn: (item: T) => string, valueFn: (item: T) => number) {
    const map = new Map<string, number>();
    for (const item of items) {
      const key = keyFn(item);
      map.set(key, (map.get(key) ?? 0) + valueFn(item));
    }
    return map;
  }

  private groupSecondsToHours<T extends { netSeconds: number }>(items: T[], keyFn: (item: T) => string, limit: number) {
    const map = new Map<string, number>();
    for (const item of items) {
      const key = keyFn(item);
      map.set(key, (map.get(key) ?? 0) + item.netSeconds / 3600);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .slice(-limit)
      .map(([key, hours]) => ({ period: key, hours: round2(hours) }));
  }

  private averageHour(dates: Date[]): number | null {
    if (dates.length === 0) return null;
    const totalMinutes = dates.reduce((sum, d) => sum + d.getHours() * 60 + d.getMinutes(), 0);
    return round2(totalMinutes / dates.length / 60);
  }

  private computeLongestStreak(dayKeys: Set<string>): number {
    if (dayKeys.size === 0) return 0;
    const sortedDays = Array.from(dayKeys)
      .map((k) => new Date(k + "T12:00:00"))
      .sort((a, b) => a.getTime() - b.getTime());

    let longest = 1;
    let current = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      const diffDays = Math.round((sortedDays[i].getTime() - sortedDays[i - 1].getTime()) / 86_400_000);
      current = diffDays === 1 ? current + 1 : 1;
      longest = Math.max(longest, current);
    }
    return longest;
  }
}
