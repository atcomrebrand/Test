import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { TrackingSessionRepository } from "../domain/tracking-session.repository";
import { TrackingJobRepository } from "../domain/tracking-job.repository";
import { LONG_SESSION_HOURS } from "./tracking-sessions.service";

const CURRENCY_FORMATTER = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Two independent sweeps on the same 6h cadence as the rest of the notification system:
 * a session still RUNNING/PAUSED past LONG_SESSION_HOURS ("esqueceu de finalizar?"), and a
 * trabalho fixo whose paymentDay matches today ("pagamento previsto hoje"). Both reuse
 * notifyIfNew's per-user/type/title/day dedup so a user never gets buzzed twice for the same thing.
 */
@Injectable()
export class TrackingNotificationsService {
  private readonly logger = new Logger(TrackingNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: TrackingSessionRepository,
    private readonly jobs: TrackingJobRepository,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_6_HOURS)
  async sweep() {
    await this.notifyLongRunningSessions();

    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      try {
        await this.notifyPaymentsDueToday(user.id);
      } catch (err) {
        this.logger.warn(`Falha ao verificar lembretes de pagamento do usuário ${user.id}: ${(err as Error).message}`);
      }
    }
  }

  async notifyLongRunningSessions() {
    const cutoff = new Date(Date.now() - LONG_SESSION_HOURS * 3600 * 1000);
    const sessions = await this.sessions.findRunningOlderThan(cutoff);
    for (const session of sessions) {
      try {
        await this.notifications.notifyIfNew(
          session.userId,
          "TRACKING_LONG_SESSION",
          "Sessão em aberto há muito tempo",
          `Sua sessão em ${session.job.name} está em andamento há mais de ${LONG_SESSION_HOURS}h. Não esqueça de finalizar.`,
        );
      } catch (err) {
        this.logger.warn(`Falha ao notificar sessão longa ${session.id}: ${(err as Error).message}`);
      }
    }
  }

  async notifyPaymentsDueToday(userId: string) {
    const today = new Date().getDate();
    const jobs = await this.jobs.findAllByUser(userId);
    const dueToday = jobs.filter((job) => job.active && job.paymentDay === today);

    for (const job of dueToday) {
      const amount = CURRENCY_FORMATTER.format(Number(job.monthlyValue));
      await this.notifications.notifyIfNew(
        userId,
        "TRACKING_PAYMENT_REMINDER",
        `Pagamento previsto hoje: ${job.name}`,
        `${amount} de ${job.company} previsto para hoje.`,
      );
    }
  }
}
