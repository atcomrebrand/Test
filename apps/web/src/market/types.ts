export interface NotaItem {
  description: string;
  storeCode: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

/** What /market/notas/scan returns: read from SEFAZ, nothing saved yet. */
export interface NotaPreview {
  accessKey: string;
  storeName: string | null;
  storeCnpj: string | null;
  purchaseDate: string | null;
  totalAmount: number | null;
  /** Sum of the parsed lines. Shown next to totalAmount so a partial read is visible. */
  itemsTotal: number;
  /** Lei 12.741/2012 approximate tax. Never present this as tax actually paid. */
  taxAmount: number | null;
  items: NotaItem[];
  totalsMismatch: boolean;
}

export interface MarketPurchaseSummary {
  id: string;
  storeName: string;
  purchaseDate: string;
  totalAmount: number;
  taxAmount: number | null;
  itemCount: number;
  accessKey: string | null;
}

export interface MarketPurchaseItem {
  id: string;
  productId: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface MarketPurchaseDetail {
  id: string;
  storeName: string;
  storeCnpj: string | null;
  accessKey: string | null;
  purchaseDate: string;
  totalAmount: number;
  taxAmount: number | null;
  notes: string | null;
  items: MarketPurchaseItem[];
}

export interface ProductPricePoint {
  purchaseDate: string;
  storeName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

/** Mirrors ProductPriceSummary in the API's domain layer field for field — the names have to match
 *  exactly, since nothing type-checks this boundary at runtime and a wrong name surfaces as
 *  "undefined" on screen rather than as a compile error. */
export interface ProductPriceSummary {
  timesBought: number;
  totalQuantity: number;
  totalSpent: number;
  lastPrice: number;
  lastDate: string;
  firstPrice: number;
  firstDate: string;
  minPrice: number;
  maxPrice: number;
  /** Quantity-weighted, not the mean of the prices — buying 10kg at one price and 1kg at another
   *  are not equal evidence of what the product costs. */
  averagePrice: number;
  /** Null with a single purchase: one data point is no trend. */
  changePercent: number | null;
  cheapestStore: string | null;
  cheapestStorePrice: number | null;
}

export interface MarketProduct {
  id: string;
  name: string;
  unit: string;
  /** Código de barras normalizado em 14 dígitos, quando a nota trouxe um. Null é o caso normal de
   *  balança e de mercado que numera do seu jeito. */
  gtin: string | null;
  /** Quantos outros nomes foram unidos neste produto. 0 = ninguém uniu nada nele. */
  mergedCount: number;
  summary: ProductPriceSummary | null;
}

/** Uma ida ao mercado, não uma linha de nota — ver groupPurchaseOccasions no domínio da API. */
export interface ProductPriceOccasion extends ProductPricePoint {
  /** Quantas linhas de nota este ponto resume. 1 na esmagadora maioria dos casos. */
  lines: number;
}

export interface MarketProductDetail extends MarketProduct {
  /** Extrato: uma entrada por linha de nota. */
  history: ProductPricePoint[];
  /** O que o gráfico desenha: uma entrada por ida ao mercado. */
  priceSeries: ProductPriceOccasion[];
  /** Os nomes que outros mercados deram e que foram unidos aqui — a tela mostra pra dar como
   *  desfazer, já que unir errado é o único jeito de estragar o histórico de preço. */
  mergedFrom: { id: string; name: string }[];
}

/** Um par que o servidor achou parecido o bastante pra perguntar. Ele nunca une sozinho. */
export interface MergeSuggestion {
  ids: [string, string];
  names: [string, string];
  /** 0..1 — quanto das palavras do nome mais curto aparece também no outro. */
  score: number;
  shared: string[];
}

export interface MonthlySpending {
  month: string;
  totalSpent: number;
  totalTax: number;
  purchaseCount: number;
  purchasesWithTax: number;
}

export interface SpendingSummary {
  totalSpent: number;
  totalTax: number;
  /** Measured over the purchases that disclosed tax, not over everything spent. */
  taxSharePercent: number | null;
  purchaseCount: number;
  purchasesWithTax: number;
  byMonth: MonthlySpending[];
}
