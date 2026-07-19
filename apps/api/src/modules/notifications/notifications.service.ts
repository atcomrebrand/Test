import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationType } from "@prisma/client";
import { nextOccurrenceOfDay } from "../../common/date/day-of-month";

const START_OF_TODAY = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

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
    const today = new Date();

    if (settings.alertUpcomingDue) {
      for (const card of cards) {
        const nextDue = nextOccurrenceOfDay(today, card.dueDay);
        const daysUntil = Math.ceil((nextDue.getTime() - today.getTime()) / 86400000);
        if (daysUntil <= 3 && daysUntil >= 0) {
          await this.createIfNotExists(userId, "UPCOMING_DUE", `Fatura do cartão ${card.name} vence em breve`, {
            message: `Sua fatura do ${card.name} vence em ${daysUntil} dia(s), no dia ${nextDue.getDate()}.`,
          });
        }
      }
    }

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

    if (settings.alertLateInstall) {
      const lateCount = await this.prisma.installment.count({ where: { userId, status: "LATE" } });
      if (lateCount > 0) {
        await this.createIfNotExists(userId, "LATE_INSTALLMENT", "Você possui parcelas atrasadas", {
          message: `Você tem ${lateCount} parcela(s) em atraso. Regularize para evitar juros.`,
        });
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
    return this.prisma.notification.create({ data: { userId, type, title, message: data.message } });
  }
}
