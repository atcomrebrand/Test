import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  CreatePurchaseWithInstallments,
  PurchaseFilters,
  PurchaseRepository,
  RecurringPurchaseForExtension,
} from "../domain/purchase.repository";
import { GeneratedInstallment } from "../domain/installment-generator";

@Injectable()
export class PurchasePrismaRepository extends PurchaseRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findManyPaginated(filters: PurchaseFilters) {
    const where: Prisma.PurchaseWhereInput = {
      userId: filters.userId,
      deletedAt: filters.trashed ? { not: null } : null,
    };

    if (filters.cardId) where.cardId = filters.cardId;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.kind) where.kind = filters.kind as any;
    if (filters.favorite !== undefined) where.isFavorite = filters.favorite;

    if (filters.year || filters.month) {
      where.purchaseDate = {};
      if (filters.year) {
        const start = new Date(filters.year, filters.month ? filters.month - 1 : 0, 1);
        const end = filters.month
          ? new Date(filters.year, filters.month, 1)
          : new Date(filters.year + 1, 0, 1);
        where.purchaseDate = { gte: start, lt: end };
      }
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.totalAmount = {
        ...(filters.minAmount !== undefined ? { gte: filters.minAmount } : {}),
        ...(filters.maxAmount !== undefined ? { lte: filters.maxAmount } : {}),
      };
    }

    if (filters.search) {
      const term = filters.search;
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { merchant: { contains: term, mode: "insensitive" } },
        { notes: { contains: term, mode: "insensitive" } },
        { tags: { has: term } },
        { category: { name: { contains: term, mode: "insensitive" } } },
        { card: { name: { contains: term, mode: "insensitive" } } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.purchase.findMany({
        where,
        include: { card: true, category: true, installments: { orderBy: { number: "asc" } } },
        orderBy: { purchaseDate: "desc" },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.purchase.count({ where }),
    ]);

    return { items, total };
  }

  findById(id: string) {
    return this.prisma.purchase.findUnique({ where: { id } });
  }

  findByIdWithInstallments(id: string) {
    return this.prisma.purchase.findUnique({
      where: { id },
      include: { card: true, category: true, installments: { orderBy: { number: "asc" }, include: { payment: true } } },
    });
  }

  async createWithInstallments(data: CreatePurchaseWithInstallments) {
    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({ data: data.purchase as any });

      // Individual creates (not createMany) so already-paid parcelas — logged for an
      // in-progress installment plan — can get their matching Payment row right away.
      for (const i of data.installments) {
        const installment = await tx.installment.create({
          data: {
            userId: data.purchase.userId,
            purchaseId: purchase.id,
            cardId: data.cardId,
            number: i.number,
            amount: i.amount,
            referenceMonth: i.referenceMonth,
            referenceYear: i.referenceYear,
            dueDate: i.dueDate,
            status: i.status ?? "PENDING",
          },
        });

        if (i.status === "PAID") {
          await tx.payment.create({
            data: {
              userId: data.purchase.userId,
              installmentId: installment.id,
              amountPaid: i.paidAmount ?? i.amount,
              paidAt: i.paidAt ?? new Date(),
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: data.purchase.userId,
          purchaseId: purchase.id,
          entity: "Purchase",
          entityId: purchase.id,
          action: "CREATE",
          changes: { name: purchase.name, totalAmount: data.purchase.totalAmount } as any,
        },
      });

      return purchase;
    });
  }

  update(id: string, data: Record<string, unknown>) {
    return this.prisma.purchase.update({ where: { id }, data: data as any });
  }

  async softDelete(id: string) {
    await this.prisma.purchase.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async restore(id: string) {
    await this.prisma.purchase.update({ where: { id }, data: { deletedAt: null } });
  }

  async hardDelete(id: string) {
    await this.prisma.purchase.delete({ where: { id } });
  }

  recentByUser(userId: string, limit: number) {
    return this.prisma.purchase.findMany({
      where: { userId, deletedAt: null },
      include: { card: true, category: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async findActiveRecurringForExtension(userId: string): Promise<RecurringPurchaseForExtension[]> {
    const purchases = await this.prisma.purchase.findMany({
      where: {
        userId,
        deletedAt: null,
        kind: "RECURRING",
        OR: [{ recurrenceEndDate: null }, { recurrenceEndDate: { gte: new Date() } }],
      },
      include: {
        installments: { orderBy: [{ referenceYear: "desc" }, { referenceMonth: "desc" }], take: 1 },
      },
    });

    return purchases.map((p) => {
      const latest = p.installments[0];
      return {
        id: p.id,
        cardId: p.cardId,
        purchaseDate: p.purchaseDate,
        monthlyAmount: Number(p.totalAmount),
        recurrenceEndDate: p.recurrenceEndDate,
        billingCycle: p.billingCycle ?? "MONTHLY",
        installmentsCount: p.installmentsCount,
        latestReferenceYear: latest?.referenceYear ?? p.purchaseDate.getFullYear(),
        latestReferenceMonth: latest?.referenceMonth ?? p.purchaseDate.getMonth() + 1,
      };
    });
  }

  async appendRecurringOccurrences(
    purchaseId: string,
    userId: string,
    cardId: string,
    occurrences: GeneratedInstallment[],
    newInstallmentsCount: number,
  ) {
    await this.prisma.$transaction([
      this.prisma.installment.createMany({
        data: occurrences.map((o) => ({
          userId,
          purchaseId,
          cardId,
          number: o.number,
          amount: o.amount,
          referenceMonth: o.referenceMonth,
          referenceYear: o.referenceYear,
          dueDate: o.dueDate,
        })),
      }),
      this.prisma.purchase.update({ where: { id: purchaseId }, data: { installmentsCount: newInstallmentsCount } }),
    ]);
  }

  async cancelFutureRecurringOccurrences(purchaseId: string, afterKey: number, recurrenceEndDate: Date) {
    const installments = await this.prisma.installment.findMany({
      where: { purchaseId, status: "PENDING" },
      select: { id: true, referenceYear: true, referenceMonth: true },
    });
    const toCancel = installments
      .filter((i) => i.referenceYear * 12 + i.referenceMonth > afterKey)
      .map((i) => i.id);

    await this.prisma.$transaction([
      this.prisma.installment.updateMany({ where: { id: { in: toCancel } }, data: { status: "CANCELLED" } }),
      this.prisma.purchase.update({ where: { id: purchaseId }, data: { recurrenceEndDate } }),
    ]);
  }
}
