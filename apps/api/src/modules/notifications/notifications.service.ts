import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationType } from "@prisma/client";
import { PushService } from "../push/push.service";

const START_OF_TODAY = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  /** `generate()` below only actually runs when a user has the app open (dashboard load, bell
   *  icon click) — fine for the in-app list, but a real OS push needs to reach the phone even
   *  while the app is closed. This sweeps every user on a fixed schedule so that still happens. */
  @Cron(CronExpression.EVERY_6_HOURS)
  async generateForAllUsers() {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    for (const user of users) {
      try {
        await this.generate(user.id);
      } catch (err) {
        this.logger.warn(`Falha ao gerar notificações para o usuário ${user.id}: ${(err as Error).message}`);
      }
    }
  }

  async list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
    return { id };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
    return { success: true };
  }

  /** Synchronous rule engine, run opportunistically (dashboard load, notifications fetch). */
  async generate(userId: string) {
    const settings = await this.prisma.setting.findUnique({ where: { userId } });
    if (!settings) return;

    const cards = await this.prisma.card.findMany({ where: { userId, active: true } });

    if (settings.alertLimitWarning) {
      for (const card of cards) {
        const spent = await this.sumSpent(card.id);
        const limit = Number(card.limitAmount);
        const pct = limit > 0 ? (spent / limit) * 100 : 0;
        if (pct >= settings.limitWarningPct) {
          await this.createIfNotExists(userId, "LIMIT_WARNING", `Limite do cartão ${card.name} quase no fim`, {
            message: `Você já utilizou ${pct.toFixed(0)}% do limite do cartão ${card.name}.`,
          });
        }
      }
    }

    if (settings.alertSpendingJump) {
      const now = new Date();
      const current = await this.sumByReferenceMonth(userId, now.getFullYear(), now.getMonth() + 1);
      const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const next = await this.sumByReferenceMonth(userId, nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1);
      if (current > 0 && next > current * 1.15) {
        const increasePct = ((next - current) / current) * 100;
        await this.createIfNotExists(userId, "SPENDING_INCREASE", "Aumento de gastos no próximo mês", {
          message: `Seus compromissos no próximo mês serão ${increasePct.toFixed(0)}% maiores que este mês.`,
        });
      }
    }
  }

  async evaluateLimitUsage(userId: string, cardId: string) {
    const card = await this.prisma.card.findUnique({ where: { id: cardId } });
    const settings = await this.prisma.setting.findUnique({ where: { userId } });
    if (!card || !settings?.alertLimitWarning) return;

    const spent = await this.sumSpent(cardId);
    const limit = Number(card.limitAmount);
    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    if (pct >= settings.limitWarningPct) {
      await this.createIfNotExists(userId, "LIMIT_WARNING", `Limite do cartão ${card.name} quase no fim`, {
        message: `Você já utilizou ${pct.toFixed(0)}% do limite do cartão ${card.name}.`,
      });
    }
  }

  private async sumSpent(cardId: string) {
    const result = await this.prisma.installment.aggregate({
      where: { cardId, status: { in: ["PENDING", "LATE"] } },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  private async sumByReferenceMonth(userId: string, year: number, month: number) {
    const result = await this.prisma.installment.aggregate({
      where: { userId, referenceYear: year, referenceMonth: month, status: { not: "CANCELLED" } },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  private async createIfNotExists(
    userId: string,
    type: NotificationType,
    title: string,
    data: { message: string },
  ) {
    const existing = await this.prisma.notification.findFirst({
      where: { userId, type, title, createdAt: { gte: START_OF_TODAY() } },
    });
    if (existing) return existing;

    const notification = await this.prisma.notification.create({ data: { userId, type, title, message: data.message } });
    // Only on the genuinely-new path — a notification that already existed today shouldn't
    // re-buzz the phone every time generate() happens to run again (page load, cron sweep).
    await this.push.notifyUser(userId, { title, body: data.message, url: "/" });
    return notification;
  }
}
