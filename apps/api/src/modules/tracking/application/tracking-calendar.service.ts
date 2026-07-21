import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { computeSessionTime } from "../domain/session-time-calculator";
import { estimateJobHourlyRate } from "../domain/job-hourly-estimate";

export interface CalendarDaySession {
  jobName: string;
  company: string;
  checkIn: Date;
  checkOut: Date | null;
  netSeconds: number;
  value: number;
  notes: string | null;
}

export interface CalendarDay {
  date: string;
  hours: number;
  revenue: number;
  sessions: CalendarDaySession[];
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * A real day-by-day grid (unlike the Parcelas Calendário, which is actually a month-tile grid) —
 * each day shows check-in/out, horas, valor recebido and observações for every session that
 * started that day, reusing the same computeSessionTime/estimateJobHourlyRate formulas as the
 * timer and dashboard so the numbers always agree.
 */
@Injectable()
export class TrackingCalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async month(userId: string, year: number, month: number): Promise<CalendarDay[]> {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    const sessions = await this.prisma.trackingSession.findMany({
      where: { userId, status: "COMPLETED", checkIn: { gte: monthStart, lt: monthEnd } },
      include: { pauses: true, job: true },
      orderBy: { checkIn: "asc" },
    });

    const byDay = new Map<string, CalendarDay>();

    for (const s of sessions) {
      const time = computeSessionTime({ checkIn: s.checkIn, checkOut: s.checkOut, pauses: s.pauses });
      const hourlyRate = estimateJobHourlyRate({
        monthlyValue: Number(s.job.monthlyValue),
        expectedHoursPerDay: s.job.expectedHoursPerDay,
        weekdays: s.job.weekdays,
      });
      const value = round2((time.netSeconds / 3600) * hourlyRate);
      const key = dayKey(s.checkIn);

      const entry = byDay.get(key) ?? { date: key, hours: 0, revenue: 0, sessions: [] };
      entry.hours = round2(entry.hours + time.netSeconds / 3600);
      entry.revenue = round2(entry.revenue + value);
      entry.sessions.push({
        jobName: s.job.name,
        company: s.job.company,
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        netSeconds: time.netSeconds,
        value,
        notes: s.notes,
      });
      byDay.set(key, entry);
    }

    return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  }
}
