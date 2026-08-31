import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { computeSessionTime } from "../domain/session-time-calculator";
import { estimateJobHourlyRate } from "../domain/job-hourly-estimate";
import { computeFreelanceHourlyRate } from "../domain/freelance-hourly-rate";
import { convertToBRL } from "../domain/currency-converter";
import { TrackingFxService } from "./tracking-fx.service";

export interface CalendarDaySession {
  jobName: string;
  company: string;
  checkIn: Date;
  checkOut: Date | null;
  netSeconds: number;
  value: number;
  notes: string | null;
  /** Só em trabalho com sistema de colocação, e só quando a pergunta foi respondida. */
  placement: number | null;
  satisfactionPercent: number | null;
  responseMinutes: number | null;
}

export interface CalendarDay {
  date: string;
  hours: number;
  revenue: number;
  sessions: CalendarDaySession[];
  /** Nomes dos trabalhos com folga marcada nesse dia (TrackingJob.daysOff) — vazio na maioria dos dias. */
  daysOff: string[];
  /**
   * A melhor (menor) colocação do dia, pra caber na célula do mês sem depender de abrir o detalhe.
   *
   * Duas sessões do mesmo serviço no mesmo dia são raras, mas quando acontecem a célula tem espaço
   * pra um número só — e mostrar a pior seria a leitura errada de um dia que teve um bom resultado.
   * O detalhe do dia continua listando cada sessão com o seu.
   */
  bestPlacement: number | null;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** TrackingJob.startDate/endDate are stored as an instant anchored to noon local time (see
 *  JobFormModal), so recovering the intended calendar date means reading local getters — going
 *  through toISOString/UTC here would shift the date by the server's UTC offset. */
function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * A real day-by-day grid (unlike the Parcelas Calendário, which is actually a month-tile grid) —
 * each day shows check-in/out, horas, valor recebido and observações for every session that
 * started that day, reusing the same computeSessionTime/hourlyRate formulas as the timer and
 * dashboard so the numbers always agree. Freelance's rate needs ALL-time hours (not just this
 * month) for totalAgreedValue÷horas to be accurate, so it's fetched separately from this month's query.
 */
@Injectable()
export class TrackingCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: TrackingFxService,
  ) {}

  async month(userId: string, year: number, month: number): Promise<CalendarDay[]> {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    const sessions = await this.prisma.trackingSession.findMany({
      where: { userId, status: "COMPLETED", checkIn: { gte: monthStart, lt: monthEnd } },
      include: { pauses: true, job: true },
      orderBy: { checkIn: "asc" },
    });

    const usdToBrlRate = sessions.some((s) => s.job.currency === "USD") ? await this.fx.getUsdToBrlRate() : null;

    const freelanceJobIds = [...new Set(sessions.filter((s) => s.job.type === "FREELANCE").map((s) => s.jobId))];
    const freelanceRateByJob = await this.computeFreelanceRates(freelanceJobIds, sessions, usdToBrlRate);

    const byDay = new Map<string, CalendarDay>();

    for (const s of sessions) {
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
      const key = dayKey(s.checkIn);

      const entry = byDay.get(key) ?? { date: key, hours: 0, revenue: 0, sessions: [], daysOff: [], bestPlacement: null };
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
        placement: s.placement,
        satisfactionPercent: s.satisfactionPercent === null ? null : Number(s.satisfactionPercent),
        responseMinutes: s.responseMinutes,
      });
      if (s.placement !== null) {
        entry.bestPlacement = entry.bestPlacement === null ? s.placement : Math.min(entry.bestPlacement, s.placement);
      }
      byDay.set(key, entry);
    }

    await this.applyDaysOff(userId, year, month, byDay);

    return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /** Marks every day off for each active FIXO job in this month, even when nothing was worked that
   *  day (the only way a pure day-off shows up at all, since byDay is otherwise seeded from
   *  sessions) — both the explicit TrackingJob.daysOff dates AND any weekday not in
   *  TrackingJob.weekdays (e.g. Sat/Sun are automatically "folga" for a Mon-Fri job), bounded by
   *  the job's startDate/endDate so it doesn't mark days before it existed or after it ended. */
  private async applyDaysOff(userId: string, year: number, month: number, byDay: Map<string, CalendarDay>) {
    const jobs = await this.prisma.trackingJob.findMany({
      where: { userId, deletedAt: null, active: true, type: "FIXO" },
      select: { name: true, daysOff: true, weekdays: true, startDate: true, endDate: true },
    });

    const daysInMonth = new Date(year, month, 0).getDate();
    const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`;

    for (const job of jobs) {
      const startKey = localDateKey(job.startDate);
      const endKey = job.endDate ? localDateKey(job.endDate) : null;
      const explicitDaysOff = new Set(job.daysOff);

      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${monthPrefix}${String(day).padStart(2, "0")}`;
        if (date < startKey || (endKey && date > endKey)) continue;

        const weekday = new Date(year, month - 1, day).getDay();
        const isOff = explicitDaysOff.has(date) || !job.weekdays.includes(weekday);
        if (!isOff) continue;

        const entry = byDay.get(date) ?? { date, hours: 0, revenue: 0, sessions: [], daysOff: [], bestPlacement: null };
        entry.daysOff.push(job.name);
        byDay.set(date, entry);
      }
    }
  }

  /** Same pattern as TrackingReportsService — freelance's valor/hora needs the true all-time total,
   *  not just this month's hours, so it's fetched in a separate unfiltered query. */
  private async computeFreelanceRates(
    freelanceJobIds: string[],
    monthSessions: { jobId: string; job: { type: string; totalAgreedValue: unknown; currency: "BRL" | "USD" } }[],
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

    const jobById = new Map(monthSessions.map((s) => [s.jobId, s.job]));
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
