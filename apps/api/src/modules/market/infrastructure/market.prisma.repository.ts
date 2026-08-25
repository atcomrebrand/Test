import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreatePurchaseData, MarketRepository } from "../domain/market.repository";

const ITEMS_INCLUDE = { items: { include: { product: true } } } as const;

@Injectable()
export class MarketPrismaRepository extends MarketRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async createPurchase(data: CreatePurchaseData) {
    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.marketPurchase.create({
        data: {
          userId: data.userId,
          storeName: data.storeName,
          storeCnpj: data.storeCnpj,
          accessKey: data.accessKey,
          purchaseDate: data.purchaseDate,
          totalAmount: data.totalAmount,
          taxAmount: data.taxAmount,
          notes: data.notes,
        },
      });

      for (const item of data.items) {
        // upsert, not create-if-missing: the same product legitimately appears twice in one nota
        // (two lines of the same item), and across notas it must land on the existing row so the
        // price history accumulates instead of forking.
        const product = await tx.marketProduct.upsert({
          where: { userId_normalizedKey: { userId: data.userId, normalizedKey: item.normalizedKey } },
          create: { userId: data.userId, name: item.description, normalizedKey: item.normalizedKey, unit: item.unit },
          update: {},
        });

        await tx.marketPurchaseItem.create({
          data: {
            userId: data.userId,
            purchaseId: purchase.id,
            productId: product.id,
            description: item.description,
            storeCode: item.storeCode,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          },
        });
      }

      return tx.marketPurchase.findUniqueOrThrow({ where: { id: purchase.id }, include: ITEMS_INCLUDE });
      // A real grocery nota is big — a confirmed SP one carried 130 lines, i.e. ~260 statements in
      // here — and Prisma's 5s interactive-transaction default would abort partway through on a VPS
      // this size. The nota still commits atomically; it's just allowed to take its time.
    }, { timeout: 60_000, maxWait: 15_000 });
  }

  findPurchaseByAccessKey(userId: string, accessKey: string) {
    return this.prisma.marketPurchase.findFirst({ where: { userId, accessKey, deletedAt: null } });
  }

  findPurchaseById(id: string) {
    return this.prisma.marketPurchase.findFirst({ where: { id, deletedAt: null }, include: ITEMS_INCLUDE });
  }

  listPurchases(userId: string, from?: Date, to?: Date) {
    return this.prisma.marketPurchase.findMany({
      where: { userId, deletedAt: null, ...(from || to ? { purchaseDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
      include: ITEMS_INCLUDE,
      orderBy: { purchaseDate: "desc" },
    });
  }

  async softDeletePurchase(id: string) {
    await this.prisma.marketPurchase.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  listProducts(userId: string) {
    return this.prisma.marketProduct.findMany({
      where: { userId },
      include: { items: { where: { purchase: { deletedAt: null } }, include: { purchase: true } } },
      orderBy: { name: "asc" },
    });
  }

  findProductById(userId: string, id: string) {
    return this.prisma.marketProduct.findFirst({
      where: { id, userId },
      include: { items: { where: { purchase: { deletedAt: null } }, include: { purchase: true } } },
    });
  }

  findProductsByIds(userId: string, ids: string[]) {
    return this.prisma.marketProduct.findMany({ where: { userId, id: { in: ids } } });
  }

  async setProductsCanonical(userId: string, ids: string[], canonicalId: string | null) {
    // `userId` no where junto do id: sem ele, um id chutado apontaria produto de outra conta.
    await this.prisma.marketProduct.updateMany({ where: { userId, id: { in: ids } }, data: { canonicalId } });
  }
}
