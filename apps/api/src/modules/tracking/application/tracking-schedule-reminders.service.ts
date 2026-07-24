import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { computeSessionTime } from "../domain/session-time-calculator";

function currentHHMM(now: Date): string {
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
}

function currentDateKey(now: Date): string {
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
}

function formatHM(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h${m.toString().padStart(2, "0")}`;
}

/**
 * Minute-by-minute "hora de iniciar" / "hora de encerrar" reminders — a plain push at the right
 * moment covers the "don't forget to start/stop the timer" need on any platform. Independent from
 * TrackingNotificationsService's 6h sweep, which is far too coarse for a schedule check.
 */
@Injectable()
export class TrackingScheduleRemindersService {
  private readonly logger = new Logger(TrackingScheduleRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    const now = new Date();
    await this.checkStartReminders(now).catch((err) => this.logger.warn(`Falha ao checar lembretes de início: ${(err as Error).message}`));
    await this.checkEndReminders(now).catch((err) => this.logger.warn(`Falha ao checar lembretes de encerramento: ${(err as Error).message}`));
  }

  async checkStartReminders(now: Date = new Date()) {
    const hhmm = currentHHMM(now);
    const weekday = now.getDay();
    const dateKey = currentDateKey(now);

    const jobs = await this.prisma.trackingJob.findMany({
      where: { active: true, deletedAt: null, expectedStartTime: hhmm, weekdays: { has: weekday }, NOT: { daysOff: { has: dateKey } } },
    });

    for (const job of jobs) {
      try {
        const activeSession = await this.prisma.trackingSession.findFirst({
          where: { jobId: job.id, status: { in: ["RUNNING", "PAUSED"] } },
        });
        if (activeSession) continue;

        await this.notifications.notifyIfNew(
          job.userId,
          "TRACKING_START_REMINDER",
          `Hora de iniciar: ${job.name}`,
          `São ${hhmm} — hora de começar o trabalho em ${job.company}.`,
        );
      } catch (err) {
        this.logger.warn(`Falha ao notificar início do trabalho ${job.id}: ${(err as Error).message}`);
      }
    }
  }

  async checkEndReminders(now: Date = new Date()) {
    const hhmm = currentHHMM(now);

    const running = await this.prisma.trackingSession.findMany({
      where: { status: "RUNNING", endReminderSentAt: null },
      include: { pauses: true, job: true },
    });

    for (const session of running) {
      try {
        const time = computeSessionTime({
          checkIn: session.checkIn,
          checkOut: null,
          pauses: session.pauses.map((p) => ({ pausedAt: p.pausedAt, resumedAt: p.resumedAt })),
          asOf: now,
        });

        const reachedByTime = session.job.expectedEndTime !== null && session.job.expectedEndTime === hhmm;
        const reachedByHours = session.job.expectedEndTime === null && time.netSeconds >= session.job.expectedHoursPerDay * 3600;
        if (!reachedByTime && !reachedByHours) continue;

        await this.notifications.notifyIfNew(
          session.userId,
          "TRACKING_END_REMINDER",
          `Hora de encerrar: ${session.job.name}`,
          `Você já trabalhou ${formatHM(time.netSeconds)} em ${session.job.company}. Hora de finalizar?`,
        );
        await this.prisma.trackingSession.update({ where: { id: session.id }, data: { endReminderSentAt: now } });
      } catch (err) {
        this.logger.warn(`Falha ao notificar encerramento da sessão ${session.id}: ${(err as Error).message}`);
      }
    }
  }
}
