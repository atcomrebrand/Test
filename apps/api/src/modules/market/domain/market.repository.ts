import { MarketProduct, MarketPurchase, MarketPurchaseItem } from "@prisma/client";

export interface CreatePurchaseItemData {
  description: string;
  storeCode: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  /** Grouping key produced by marketProductKey() — decides which MarketProduct the line joins. */
  normalizedKey: string;
  /** Código de barras normalizado (parseGtin), quando o "Código:" da nota era um. Quando vem, ele
   *  manda: é identidade global, a chave do nome é só o fallback. */
  gtin: string | null;
}

export interface CreatePurchaseData {
  userId: string;
  storeName: string;
  storeCnpj: string | null;
  accessKey: string | null;
  purchaseDate: Date;
  totalAmount: number;
  /** Lei 12.741/2012 approximate tax total, when the nota disclosed one. */
  taxAmount: number | null;
  notes?: string;
  items: CreatePurchaseItemData[];
}

export type PurchaseWithItems = MarketPurchase & { items: (MarketPurchaseItem & { product: MarketProduct })[] };
export type ItemWithContext = MarketPurchaseItem & { purchase: MarketPurchase };

export abstract class MarketRepository {
  /** Creates the purchase, its items, and any products the items introduce, in one transaction —
   *  a half-written nota (purchase saved, items lost) would be worse than no import at all. */
  abstract createPurchase(data: CreatePurchaseData): Promise<PurchaseWithItems>;
  abstract findPurchaseByAccessKey(userId: string, accessKey: string): Promise<MarketPurchase | null>;
  abstract findPurchaseById(id: string): Promise<PurchaseWithItems | null>;
  abstract listPurchases(userId: string, from?: Date, to?: Date): Promise<PurchaseWithItems[]>;
  abstract softDeletePurchase(id: string): Promise<void>;

  abstract listProducts(userId: string): Promise<(MarketProduct & { items: ItemWithContext[] })[]>;
  abstract findProductById(userId: string, id: string): Promise<(MarketProduct & { items: ItemWithContext[] }) | null>;
  abstract findProductsByIds(userId: string, ids: string[]): Promise<MarketProduct[]>;
  /** Aponta (ou desaponta, com null) produtos pro canônico. Em lote porque unir três produtos de
   *  uma vez tem que ser uma coisa só: metade unida é um histórico partido no meio. */
  abstract setProductsCanonical(userId: string, ids: string[], canonicalId: string | null): Promise<void>;
}
