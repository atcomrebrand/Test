import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { InstallmentsService } from "../installments/installments.service";
import { PurchasesService } from "../purchases/application/purchases.service";
import { nextOccurrenceOfDay } from "../../common/date/day-of-month";

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly installments: InstallmentsService,
    private readonly purchases: PurchasesService,
  ) {}

  async summary(userId: string) {
    await Promise.all([this.installments.autoSettleOverdueInstallments(userId), this.purchases.extendRecurringPurchases(userId)]);

    const settings = await this.prisma.setting.findUnique({ where: { userId } });
    const includeFinancing = settings?.includeFinancingInTotals ?? true;

    const now = new Date();
    const thisMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = { year: nextMonthDate.getFullYear(), month: nextMonthDate.getMonth() + 1 };

    const [
      cardsCommittedThisMonth,
      cardsCommittedNextMonth,
      remainingAgg,
      openCount,
      recentPurchases,
      cards,
      financingAmounts,
      financingLateCount,
      financingActiveCount,
    ] = await Promise.all([
      this.sumByMonth(userId, thisMonth.year, thisMonth.month),
      this.sumByMonth(userId, nextMonth.year, nextMonth.month),
      this.prisma.installment.aggregate({
        where: { userId, status: { in: ["PENDING", "LATE"] }, purchase: { deletedAt: null } },
        _sum: { amount: true },
      }),
      this.prisma.installment.count({ where: { userId, status: { in: ["PENDING", "LATE"] }, purchase: { deletedAt: null } } }),
      this.prisma.purchase.findMany({
        where: { userId, deletedAt: null },
        include: { card: true, category: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      this.prisma.card.findMany({ where: { userId, active: true } }),
      this.financingAmountsByMonth(userId, thisMonth, nextMonth),
      this.prisma.financingInstallment.count({ where: { userId, status: "LATE" } }),
      this.prisma.financing.count({ where: { userId, active: true } }),
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
        where: { cardId: card.id, status: { in: ["PENDING", "LATE"] }, purchase: { deletedAt: null } },
        _sum: { amount: true },
      });
      totalSpent += Number(spentAgg._sum.amount ?? 0);
    }

    const financingThisMonth = includeFinancing ? financingAmounts.thisMonth : 0;
    const financingNextMonth = includeFinancing ? financingAmounts.nextMonth : 0;
    const financingRemaining = includeFinancing ? financingAmounts.remaining : 0;
    const committedThisMonth = cardsCommittedThisMonth + financingThisMonth;
    const committedNextMonth = cardsCommittedNextMonth + financingNextMonth;

    return {
      committedThisMonth,
      committedNextMonth,
      estimatedNextInvoice: committedNextMonth,
      totalRemaining: Number(remainingAgg._sum.amount ?? 0) + financingRemaining,
      openInstallmentsCount: openCount,
      recentPurchases,
      nextClosing,
      nextDue,
      limitUsage: {
        totalLimit,
        totalSpent,
        usagePct: totalLimit > 0 ? Math.min((totalSpent / totalLimit) * 100, 100) : 0,
      },
      includeFinancingInTotals: includeFinancing,
      financing: {
        activeCount: financingActiveCount,
        committedThisMonth: financingAmounts.thisMonth,
        totalRemaining: financingAmounts.remaining,
        lateCount: financingLateCount,
      },
    };
  }

  async spendingEvolution(userId: string) {
    const settings = await this.prisma.setting.findUnique({ where: { userId } });
    const includeFinancing = settings?.includeFinancingInTotals ?? true;

    const now = new Date();
    const months: { year: number; month: number }[] = [];
    for (let offset = -5; offset <= 6; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      months.push({ year: d.getFullYear(), month: d.getMonth() + 1 });
    }

    const results = await Promise.all(
      months.map(async (m) => {
        const cardsTotal = await this.sumByMonth(userId, m.year, m.month);
        if (!includeFinancing) return cardsTotal;
        const monthStart = new Date(m.year, m.month - 1, 1);
        const monthEnd = new Date(m.year, m.month, 1);
        const financingAgg = await this.prisma.financingInstallment.aggregate({
          where: { userId, dueDate: { gte: monthStart, lt: monthEnd }, status: { not: "CANCELLED" } },
          _sum: { amount: true },
        });
        return cardsTotal + Number(financingAgg._sum.amount ?? 0);
      }),
    );

    return months.map((m, idx) => ({ year: m.year, month: m.month, total: results[idx] }));
  }

  private async financingAmountsByMonth(
    userId: string,
    thisMonth: { year: number; month: number },
    nextMonth: { year: number; month: number },
  ) {
    const thisMonthStart = new Date(thisMonth.year, thisMonth.month - 1, 1);
    const thisMonthEnd = new Date(thisMonth.year, thisMonth.month, 1);
    const nextMonthEnd = new Date(nextMonth.year, nextMonth.month, 1);

    const [thisMonthAgg, nextMonthAgg, remainingAgg] = await Promise.all([
      this.prisma.financingInstallment.aggregate({
        where: { userId, dueDate: { gte: thisMonthStart, lt: thisMonthEnd }, status: { not: "CANCELLED" } },
        _sum: { amount: true },
      }),
      this.prisma.financingInstallment.aggregate({
        where: { userId, dueDate: { gte: thisMonthEnd, lt: nextMonthEnd }, status: { not: "CANCELLED" } },
        _sum: { amount: true },
      }),
      this.prisma.financingInstallment.aggregate({
        where: { userId, status: { in: ["PENDING", "LATE"] } },
        _sum: { amount: true },
      }),
    ]);

    return {
      thisMonth: Number(thisMonthAgg._sum.amount ?? 0),
      nextMonth: Number(nextMonthAgg._sum.amount ?? 0),
      remaining: Number(remainingAgg._sum.amount ?? 0),
    };
  }

  async byCategory(userId: string) {
    const now = new Date();
    const rows = await this.prisma.installment.findMany({
      where: {
        userId,
        referenceYear: now.getFullYear(),
        referenceMonth: now.getMonth() + 1,
        status: { not: "CANCELLED" },
        purchase: { deletedAt: null },
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
      where: { userId, referenceYear: year, referenceMonth: month, status: { not: "CANCELLED" }, purchase: { deletedAt: null } },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }
}
