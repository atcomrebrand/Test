import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class TimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, monthsBack = 3, monthsForward = 9) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + monthsForward + 1, 1);

    const installments = await this.prisma.installment.findMany({
      where: {
        userId,
        status: { not: "CANCELLED" },
        OR: buildMonthRangeOr(start, end),
      },
      include: { purchase: { include: { category: true, card: true } } },
      orderBy: [{ referenceYear: "asc" }, { referenceMonth: "asc" }],
    });

    const groups = new Map<string, { year: number; month: number; total: number; items: any[] }>();
    for (const inst of installments) {
      const key = `${inst.referenceYear}-${inst.referenceMonth}`;
      if (!groups.has(key)) groups.set(key, { year: inst.referenceYear, month: inst.referenceMonth, total: 0, items: [] });
      const group = groups.get(key)!;
      group.total += Number(inst.amount);
      group.items.push({
        installmentId: inst.id,
        purchaseId: inst.purchase.id,
        name: inst.purchase.name,
        merchant: inst.purchase.merchant,
        category: inst.purchase.category,
        card: inst.purchase.card,
        amount: Number(inst.amount),
        number: inst.number,
        installmentsCount: inst.purchase.installmentsCount,
        isCash: inst.purchase.kind === "CASH",
        status: inst.status,
      });
    }

    return Array.from(groups.values()).sort((a, b) => (a.year - b.year) * 12 + (a.month - b.month));
  }
}

function buildMonthRangeOr(start: Date, end: Date) {
  const months: { referenceYear: number; referenceMonth: number }[] = [];
  const cursor = new Date(start);
  while (cursor < end) {
    months.push({ referenceYear: cursor.getFullYear(), referenceMonth: cursor.getMonth() + 1 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}
