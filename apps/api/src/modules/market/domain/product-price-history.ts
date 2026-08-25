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

export interface ProductPriceOccasion {
  purchaseDate: string;
  storeName: string;
  /** Preço unitário da ocasião, ponderado pela quantidade quando ela teve mais de uma linha. */
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  /** Quantas linhas de nota este ponto resume. 1 na esmagadora maioria dos casos. */
  lines: number;
}

/**
 * Uma compra é uma **ida ao mercado**, não uma linha de nota.
 *
 * Bug real: comprando três unidades do mesmo produto, o mercado imprime três linhas na nota, e cada
 * uma virava um ponto no gráfico — três bolinhas empilhadas no mesmo dia, com a linha zigue-zagueando
 * entre elas — além de "3 compras" no card, quando foi uma ida só. Agrupar por dia **e loja** é o que
 * corresponde ao que a pessoa fez: comprar o mesmo produto em dois mercados no mesmo dia são duas
 * observações de preço de verdade e continuam sendo dois pontos.
 *
 * Quando a ocasião tem mais de uma linha com preços diferentes (parte em promoção, parte não), o
 * preço do ponto é a média **ponderada pela quantidade** — a mesma razão pela qual `averagePrice` é
 * ponderado: 10 unidades a um preço e 1 a outro não são evidências iguais do que o produto custa.
 */
export function groupPurchaseOccasions(points: ProductPricePoint[]): ProductPriceOccasion[] {
  const porOcasiao = new Map<string, ProductPriceOccasion>();

  for (const point of points) {
    const chave = `${point.purchaseDate}|${point.storeName}`;
    const atual = porOcasiao.get(chave);
    if (!atual) {
      porOcasiao.set(chave, { ...point, lines: 1 });
      continue;
    }
    atual.quantity += point.quantity;
    atual.totalPrice += point.totalPrice;
    atual.lines += 1;
    // Recalculado a cada linha em vez de acumulado: é sempre total ÷ quantidade, então não depende
    // da ordem em que as linhas chegaram.
    atual.unitPrice = atual.quantity > 0 ? atual.totalPrice / atual.quantity : point.unitPrice;
  }

  return [...porOcasiao.values()].sort(
    (a, b) => a.purchaseDate.localeCompare(b.purchaseDate) || a.storeName.localeCompare(b.storeName, "pt-BR"),
  );
}

/**
 * Condenses every time a product was bought into the numbers the price-history view answers
 * questions with: is it getting more expensive, how much have I spent on it, which store sells it
 * cheapest. Pure and order-independent — points are sorted internally, so callers can hand over
 * rows in whatever order the database returned them.
 *
 * Tudo o que fala de **preço** ou de **quantas vezes** é medido por ocasião de compra, não por linha
 * de nota (ver groupPurchaseOccasions). Os totais — gasto e quantidade — são soma pura e não mudam
 * com o agrupamento. O que isso garante é que o card e o gráfico logo abaixo dele contem a mesma
 * história: número que não bate com o gráfico ao lado parece bug mesmo quando os dois estão certos.
 */
export function summarizeProductPrices(points: ProductPricePoint[]): ProductPriceSummary | null {
  if (points.length === 0) return null;

  const sorted = groupPurchaseOccasions(points);
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
