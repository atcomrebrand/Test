import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async year(userId: string, year: number) {
    const rows = await this.prisma.installment.groupBy({
      by: ["referenceMonth"],
      where: { userId, referenceYear: year, status: { not: "CANCELLED" } },
      _sum: { amount: true },
      _count: { _all: true },
    });

    const purchaseCounts = await this.prisma.installment.findMany({
      where: { userId, referenceYear: year, status: { not: "CANCELLED" } },
      select: { referenceMonth: true, purchaseId: true },
      distinct: ["referenceMonth", "purchaseId"],
    });
    const purchasesByMonth = new Map<number, number>();
    for (const row of purchaseCounts) {
      purchasesByMonth.set(row.referenceMonth, (purchasesByMonth.get(row.referenceMonth) ?? 0) + 1);
    }

    const byMonth = new Map(rows.map((r) => [r.referenceMonth, r]));
    const totals = Array.from({ length: 12 }, (_, idx) => {
      const month = idx + 1;
      const row = byMonth.get(month);
      return {
        month,
        year,
        total: Number(row?._sum.amount ?? 0),
        installmentsCount: row?._count._all ?? 0,
        purchasesCount: purchasesByMonth.get(month) ?? 0,
      };
    });

    const max = Math.max(...totals.map((t) => t.total), 1);
    return totals.map((t) => ({ ...t, weight: t.total === 0 ? "none" : weightBucket(t.total / max) }));
  }

  month(userId: string, year: number, month: number) {
    return this.prisma.installment.findMany({
      where: { userId, referenceYear: year, referenceMonth: month },
      include: { purchase: { include: { category: true } }, card: true, payment: true },
      orderBy: { dueDate: "asc" },
    });
  }
}

function weightBucket(ratio: number): "low" | "medium" | "high" {
  if (ratio >= 0.66) return "high";
  if (ratio >= 0.33) return "medium";
  return "low";
}
