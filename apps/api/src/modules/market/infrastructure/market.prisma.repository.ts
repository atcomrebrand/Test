import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { CreatePurchaseData, CreatePurchaseItemData, MarketRepository } from "../domain/market.repository";

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
        const product = await resolveProduct(tx, data.userId, item);

        await tx.marketPurchaseItem.create({
          data: {
            userId: data.userId,
            purchaseId: purchase.id,
            productId: product.id,
            description: item.description,
            storeCode: item.storeCode,
            gtin: item.gtin,
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

/**
 * Em que produto esta linha da nota entra.
 *
 * Duas camadas de identidade, nesta ordem:
 *
 * 1. **Código de barras**, quando a nota trouxe um. É global — o mesmo produto tem o mesmo número
 *    em qualquer mercado —, então é a única evidência que dispensa adivinhação.
 * 2. **Chave normalizada do nome**, o comportamento de sempre. É o que atende balança e mercado que
 *    numera do seu jeito, que nunca terão GTIN.
 *
 * O upsert por chave normalizada continua sendo upsert e não create-if-missing: o mesmo produto
 * aparece duas vezes numa nota só (duas linhas do mesmo item) e precisa cair na mesma linha entre
 * notas, senão o histórico de preço bifurca.
 */
async function resolveProduct(
  tx: Prisma.TransactionClient,
  userId: string,
  item: CreatePurchaseItemData,
): Promise<{ id: string }> {
  const porNome = { userId_normalizedKey: { userId, normalizedKey: item.normalizedKey } };

  if (!item.gtin) {
    return tx.marketProduct.upsert({
      where: porNome,
      create: { userId, name: item.description, normalizedKey: item.normalizedKey, unit: item.unit },
      update: {},
    });
  }

  const porCodigo = await tx.marketProduct.findFirst({ where: { userId, gtin: item.gtin } });
  const existentePeloNome = await tx.marketProduct.findUnique({ where: porNome });

  // Nome novo pra um código já conhecido: é exatamente o caso do mesmo produto com nome diferente
  // em cada mercado, e a linha entra direto no produto que já existe.
  if (porCodigo) {
    // ...e se o nome desta linha já tinha virado um produto separado antes do código aparecer, o
    // código acabou de provar que os dois são o mesmo. Unir aqui não é chute — é o único momento em
    // que a prova existe. Fica visível e reversível na tela de detalhe do produto.
    if (existentePeloNome && existentePeloNome.id !== porCodigo.id && existentePeloNome.canonicalId === null) {
      await tx.marketProduct.update({ where: { id: existentePeloNome.id }, data: { canonicalId: porCodigo.id } });
    }
    return porCodigo;
  }

  // Código novo num produto que já existe pelo nome: **adoção**. É assim que o histórico antigo
  // ganha identidade global sem ser recriado nem re-chaveado — o produto continua sendo a mesma
  // linha, com as mesmas compras, agora identificável entre mercados.
  if (existentePeloNome) {
    if (existentePeloNome.gtin === null) {
      await tx.marketProduct.update({ where: { id: existentePeloNome.id }, data: { gtin: item.gtin } });
    }
    return existentePeloNome;
  }

  return tx.marketProduct.create({
    data: { userId, name: item.description, normalizedKey: item.normalizedKey, unit: item.unit, gtin: item.gtin },
  });
}
