import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { DividendsService } from "./dividends.service";

const CURRENCY_FORMATTER = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Alerts the user on the day a dividend/provento actually lands, not just when they happen to
 * open the app and glance at the calendar — "Provento chegando: PETR4 — R$ 45,20 cai na conta
 * hoje." Reuses getPortfolioCalendar's existing ex-date position reconstruction (same logic the
 * calendar page and the auto-sync already share) rather than a separate calculation, so "how much"
 * here always matches what the Proventos page already shows for the same event.
 */
@Injectable()
export class DividendNotificationsService {
  private readonly logger = new Logger(DividendNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dividends: DividendsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Same 6-hour cadence as NotificationsService.generateForAllUsers — this is the only way a
   *  push reaches the phone on payment day for someone who doesn't open the app that day. */
  @Cron(CronExpression.EVERY_6_HOURS)
  async notifyTodaysPayments() {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      try {
        await this.notifyForUser(user.id);
      } catch (err) {
        this.logger.warn(`Falha ao verificar proventos do dia para o usuário ${user.id}: ${(err as Error).message}`);
      }
    }
  }

  async notifyForUser(userId: string) {
    const today = todayIso();
    const calendar = await this.dividends.getPortfolioCalendar(userId);
    const payingToday = calendar.filter((entry) => entry.paymentDate === today && entry.estimatedAmount !== null && entry.estimatedAmount > 0);

    for (const entry of payingToday) {
      const amount = CURRENCY_FORMATTER.format(entry.estimatedAmount!);
      const assetLabel = entry.name ? `${entry.name} (${entry.ticker})` : entry.ticker;
      await this.notifications.notifyIfNew(
        userId,
        "DIVIDEND_PAYMENT",
        `Provento chegando: ${entry.ticker}`,
        `${amount} de ${assetLabel} cai na conta hoje.`,
      );
    }
  }
}
