export interface ProductPricePoint {
  /** ISO yyyy-mm-dd of the purchase this price was paid on. */
  purchaseDate: string;
  storeName: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

export interface ProductPriceSummary {
  timesBought: number;
  totalSpent: number;
  /** Total units/kg accumulated across every purchase of this product. */
  totalQuantity: number;
  lastPrice: number;
  lastDate: string;
  firstPrice: number;
  firstDate: string;
  minPrice: number;
  maxPrice: number;
  /** Quantity-weighted, so a 5kg buy at a promo price counts for more than a 0,3kg top-up at full
   *  price — the simple mean of unit prices would misrepresent what the product actually costs. */
  averagePrice: number;
  /** Last price vs first price, in percent. Null when the product was only ever bought once (no
   *  span to compare) or when the first price was zero. */
  changePercent: number | null;
  /** Cheapest store on record and what it charged, for the "onde compensa comprar" comparison.
   *  Ties resolve to the most recent, since an old low price is less actionable than a current one. */
  cheapestStore: string | null;
  cheapestStorePrice: number | null;
}

/**
 * Condenses every time a product was bought into the numbers the price-history view answers
 * questions with: is it getting more expensive, how much have I spent on it, which store sells it
 * cheapest. Pure and order-independent — points are sorted internally, so callers can hand over
 * rows in whatever order the database returned them.
 */
export function summarizeProductPrices(points: ProductPricePoint[]): ProductPriceSummary | null {
  if (points.length === 0) return null;

  const sorted = [...points].sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const totalQuantity = sorted.reduce((sum, p) => sum + p.quantity, 0);
  const totalSpent = sorted.reduce((sum, p) => sum + p.totalPrice, 0);
  const prices = sorted.map((p) => p.unitPrice);

  // A zero first price (a freebie, or a nota line the store zeroed out) makes the percentage
  // meaningless rather than infinite, so it's reported as "no comparison" instead.
  const changePercent = sorted.length > 1 && first.unitPrice > 0 ? ((last.unitPrice - first.unitPrice) / first.unitPrice) * 100 : null;

  const cheapest = sorted.reduce((best, p) => (p.unitPrice < best.unitPrice ? p : best), sorted[sorted.length - 1]);

  return {
    timesBought: sorted.length,
    totalSpent,
    totalQuantity,
    lastPrice: last.unitPrice,
    lastDate: last.purchaseDate,
    firstPrice: first.unitPrice,
    firstDate: first.purchaseDate,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    averagePrice: totalQuantity > 0 ? totalSpent / totalQuantity : 0,
    changePercent,
    cheapestStore: cheapest.storeName,
    cheapestStorePrice: cheapest.unitPrice,
  };
}
