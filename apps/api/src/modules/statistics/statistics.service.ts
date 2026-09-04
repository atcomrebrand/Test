import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(userId: string) {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear() + 1, 0, 1);

    const [paidAgg, remainingAgg, cards, biggestPurchase, categoryAgg, annualAgg, installmentAgg, cashAgg] =
      await Promise.all([
        this.prisma.installment.aggregate({ where: { userId, status: "PAID", purchase: { deletedAt: null } }, _sum: { amount: true } }),
        this.prisma.installment.aggregate({
          where: { userId, status: { in: ["PENDING", "LATE"] }, purchase: { deletedAt: null } },
          _sum: { amount: true },
        }),
        this.prisma.card.findMany({ where: { userId, active: true } }),
        this.prisma.purchase.findFirst({
          where: { userId, deletedAt: null },
          orderBy: { totalAmount: "desc" },
          include: { card: true, category: true },
        }),
        this.prisma.installment.groupBy({
          by: ["purchaseId"],
          where: { userId, status: { not: "CANCELLED" }, purchase: { deletedAt: null } },
          _sum: { amount: true },
        }),
        this.prisma.installment.aggregate({
          where: { userId, status: { not: "CANCELLED" }, dueDate: { gte: yearStart, lt: yearEnd }, purchase: { deletedAt: null } },
          _sum: { amount: true },
        }),
        this.prisma.purchase.aggregate({
          where: { userId, deletedAt: null, kind: "INSTALLMENT" },
          _sum: { totalAmount: true },
        }),
        this.prisma.purchase.aggregate({
          where: { userId, deletedAt: null, kind: "CASH" },
          _sum: { totalAmount: true },
        }),
      ]);

    const remainingByCard = await Promise.all(
      cards.map(async (card) => {
        const agg = await this.prisma.installment.aggregate({
          where: { cardId: card.id, status: { in: ["PENDING", "LATE"] }, purchase: { deletedAt: null } },
          _sum: { amount: true },
        });
        return { cardId: card.id, cardName: card.name, color: card.color, remaining: Number(agg._sum.amount ?? 0) };
      }),
    );

    const topCategoryRows = await this.prisma.installment.findMany({
      where: { userId, status: { not: "CANCELLED" }, purchase: { deletedAt: null } },
      include: { purchase: { include: { category: true } } },
    });
    const categoryTotals = new Map<string, { name: string; total: number }>();
    for (const row of topCategoryRows) {
      const name = row.purchase.category?.name ?? "Sem categoria";
      const current = categoryTotals.get(name) ?? { name, total: 0 };
      current.total += Number(row.amount);
      categoryTotals.set(name, current);
    }
    const topCategory = Array.from(categoryTotals.values()).sort((a, b) => b.total - a.total)[0] ?? null;

    const monthsWithData = new Set(
      (
        await this.prisma.installment.findMany({
          where: { userId, status: { not: "CANCELLED" }, purchase: { deletedAt: null } },
          select: { referenceYear: true, referenceMonth: true },
          distinct: ["referenceYear", "referenceMonth"],
        })
      ).map((r) => `${r.referenceYear}-${r.referenceMonth}`),
    );
    const totalCommitted = categoryAgg.reduce((acc, r) => acc + Number(r._sum.amount ?? 0), 0);
    const monthlyAverage = monthsWithData.size > 0 ? totalCommitted / monthsWithData.size : 0;

    return {
      totalPaid: Number(paidAgg._sum.amount ?? 0),
      totalRemaining: Number(remainingAgg._sum.amount ?? 0),
      remainingByCard,
      biggestPurchase,
      topCategory,
      monthlyAverage,
      annualSpending: Number(annualAgg._sum.amount ?? 0),
      installmentTotal: Number(installmentAgg._sum.totalAmount ?? 0),
      cashTotal: Number(cashAgg._sum.totalAmount ?? 0),
    };
  }
}
