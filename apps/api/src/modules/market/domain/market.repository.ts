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
}

export interface CreatePurchaseData {
  userId: string;
  storeName: string;
  storeCnpj: string | null;
  accessKey: string | null;
  purchaseDate: Date;
  totalAmount: number;
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
}
