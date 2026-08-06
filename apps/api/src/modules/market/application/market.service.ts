import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { MarketRepository } from "../domain/market.repository";
import { ProductPricePoint, summarizeProductPrices } from "../domain/product-price-history";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class MarketService {
  constructor(private readonly market: MarketRepository) {}

  async listPurchases(userId: string, from?: string, to?: string) {
    const purchases = await this.market.listPurchases(userId, from ? new Date(from) : undefined, to ? new Date(to) : undefined);
    return purchases.map((purchase) => ({
      id: purchase.id,
      storeName: purchase.storeName,
      purchaseDate: purchase.purchaseDate,
      totalAmount: Number(purchase.totalAmount),
      itemCount: purchase.items.length,
      accessKey: purchase.accessKey,
    }));
  }

  async getPurchase(userId: string, id: string) {
    const purchase = await this.market.findPurchaseById(id);
    if (!purchase) throw new NotFoundException("Compra não encontrada.");
    if (purchase.userId !== userId) throw new ForbiddenException();
    return {
      ...purchase,
      totalAmount: Number(purchase.totalAmount),
      items: purchase.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
      })),
    };
  }

  async removePurchase(userId: string, id: string) {
    const purchase = await this.market.findPurchaseById(id);
    if (!purchase) throw new NotFoundException("Compra não encontrada.");
    if (purchase.userId !== userId) throw new ForbiddenException();
    await this.market.softDeletePurchase(id);
    return { id };
  }

  /** Every product ever bought, each with its price summary — the list the "meus produtos" screen
   *  and the "o que subiu de preço" ranking are both built from. */
  async listProducts(userId: string) {
    const products = await this.market.listProducts(userId);
    return products
      .map((product) => ({
        id: product.id,
        name: product.name,
        unit: product.unit,
        summary: summarizeProductPrices(product.items.map(toPricePoint)),
      }))
      .filter((product) => product.summary !== null)
      .sort((a, b) => b.summary!.totalSpent - a.summary!.totalSpent);
  }

  async getProduct(userId: string, id: string) {
    const product = await this.market.findProductById(userId, id);
    if (!product) throw new NotFoundException("Produto não encontrado.");

    const points = product.items.map(toPricePoint).sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
    return {
      id: product.id,
      name: product.name,
      unit: product.unit,
      summary: summarizeProductPrices(points),
      history: points,
    };
  }
}

function toPricePoint(item: { quantity: unknown; unitPrice: unknown; totalPrice: unknown; purchase: { purchaseDate: Date; storeName: string } }): ProductPricePoint {
  return {
    purchaseDate: isoDate(item.purchase.purchaseDate),
    storeName: item.purchase.storeName,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
    totalPrice: Number(item.totalPrice),
  };
}
