import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { InstallmentsService } from "../installments/installments.service";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly installments: InstallmentsService,
  ) {}

  async summary(userId: string) {
    await this.installments.refreshLateStatuses(userId);

    const now = new Date();
    const thisMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = { year: nextMonthDate.getFullYear(), month: nextMonthDate.getMonth() + 1 };

    const [committedThisMonth, committedNextMonth, remainingAgg, openCount, recentPurchases, cards, lateCount] =
      await Promise.all([
        this.sumByMonth(userId, thisMonth.year, thisMonth.month),
        this.sumByMonth(userId, nextMonth.year, nextMonth.month),
        this.prisma.installment.aggregate({
          where: { userId, status: { in: ["PENDING", "LATE"] } },
          _sum: { amount: true },
        }),
        this.prisma.installment.count({ where: { userId, status: { in: ["PENDING", "LATE"] } } }),
        this.prisma.purchase.findMany({
          where: { userId, deletedAt: null },
          include: { card: true, category: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        this.prisma.card.findMany({ where: { userId, active: true } }),
        this.prisma.installment.count({ where: { userId, status: "LATE" } }),
      ]);

    let nextClosing: { cardId: string; cardName: string; date: Date } | null = null;
    let nextDue: { cardId: string; cardName: string; date: Date } | null = null;
    let totalLimit = 0;
    let totalSpent = 0;

    for (const card of cards) {
      const closing = nextOccurrenceOfDay(now, card.closingDay);
      const due = nextOccurrenceOfDay(now, card.dueDay);
      if (!nextClosing || closing < nextClosing.date) nextClosing = { cardId: card.id, cardName: card.name, date: closing };
      if (!nextDue || due < nextDue.date) nextDue = { cardId: card.id, cardName: card.name, date: due };

      totalLimit += Number(card.limitAmount);
      const spentAgg = await this.prisma.installment.aggregate({
        where: { cardId: card.id, status: { not: "CANCELLED" } },
        _sum: { amount: true },
      });
      totalSpent += Number(spentAgg._sum.amount ?? 0);
    }

    return {
      committedThisMonth,
      committedNextMonth,
      estimatedNextInvoice: committedNextMonth,
      totalRemaining: Number(remainingAgg._sum.amount ?? 0),
      openInstallmentsCount: openCount,
      lateInstallmentsCount: lateCount,
      recentPurchases,
      nextClosing,
      nextDue,
      limitUsage: {
        totalLimit,
        totalSpent,
        usagePct: totalLimit > 0 ? Math.min((totalSpent / totalLimit) * 100, 100) : 0,
      },
    };
  }

  async spendingEvolution(userId: string) {
    const now = new Date();
    const months: { year: number; month: number }[] = [];
    for (let offset = -5; offset <= 6; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    const results = await Promise.all(months.map((m) => this.sumByMonth(userId, m.year, m.month)));

    return months.map((m, idx) => ({ year: m.year, month: m.month, total: results[idx] }));
  }

  async byCategory(userId: string) {
    const now = new Date();
    const rows = await this.prisma.installment.findMany({
      where: {
        userId,
        referenceYear: now.getFullYear(),
        referenceMonth: now.getMonth() + 1,
        status: { not: "CANCELLED" },
      },
      include: { purchase: { include: { category: true } } },
    });

    const map = new Map<string, { name: string; color: string; total: number }>();
    for (const row of rows) {
      const cat = row.purchase.category;
      const key = cat?.id ?? "uncategorized";
      const name = cat?.name ?? "Sem categoria";
      const color = cat?.color ?? "#6B7280";
      const current = map.get(key) ?? { name, color, total: 0 };
      current.total += Number(row.amount);
      map.set(key, current);
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }

  private async sumByMonth(userId: string, year: number, month: number) {
    const result = await this.prisma.installment.aggregate({
      where: { userId, referenceYear: year, referenceMonth: month, status: { not: "CANCELLED" } },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }
}

function nextOccurrenceOfDay(from: Date, day: number): Date {
  const candidate = new Date(from.getFullYear(), from.getMonth(), day, 12, 0, 0);
  if (candidate < from) candidate.setMonth(candidate.getMonth() + 1);
  return candidate;
}
