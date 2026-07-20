/**
 * Decoupled market-data provider contracts. The interface layer (controllers) must never call
 * these directly — always go through MarketPriceService/EconomicIndicatorService, which add
 * caching. Swapping BRAPI for Alpha Vantage/Finnhub later only means writing a new class here.
 */

export interface QuoteResult {
  price: number;
  currency: string;
  /** True when the provider couldn't price this exact instrument and substituted a related one
   *  (e.g. a B3 fractional-lot ticker priced via its round-lot counterpart) — must be disclosed
   *  to the user, never presented as an exact quote. */
  approximate?: boolean;
}

export interface HistoricalPricePoint {
  date: string;
  close: number;
}

/** Loosely typed on purpose — each provider exposes whatever fields it has, and the UI renders
 *  whatever keys are present instead of a rigid schema every provider must satisfy. */
export type AssetFundamentals = Record<string, number | string | null>;

export interface QuoteDetail extends QuoteResult {
  changePercent: number | null;
  history: HistoricalPricePoint[];
  fundamentals: AssetFundamentals;
}

export interface CatalogEntry {
  ticker: string;
  name: string;
  /** e.g. B3 sector for stocks, or the type BRAPI reports (stock/fund/bdr). */
  type?: string;
  logoUrl?: string;
}

export type ChartRange = "3M" | "6M" | "12M" | "MAX" | "CUSTOM";

export interface ChartRangeOptions {
  range: ChartRange;
  /** ISO date (YYYY-MM-DD). Required when range === "CUSTOM"; ignored otherwise. */
  from?: string;
  to?: string;
}

/** Whole days between two ISO dates — providers use this to size how much history to request for
 *  a CUSTOM range before slicing the result down to the exact [from, to] window. */
export function daysBetweenIsoDates(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

const VALID_CHART_RANGES: ChartRange[] = ["3M", "6M", "12M", "MAX", "CUSTOM"];

/** Parses the range/from/to query params shared by the history endpoints. Falls back to 12M for
 *  an unrecognized range, and to MAX if CUSTOM is requested without both dates. */
export function parseChartRangeOptions(range: string | undefined, from: string | undefined, to: string | undefined): ChartRangeOptions {
  const normalizedRange = (range?.toUpperCase() as ChartRange | undefined) ?? "12M";
  if (!VALID_CHART_RANGES.includes(normalizedRange)) return { range: "12M" };
  if (normalizedRange === "CUSTOM") {
    if (!from || !to) return { range: "MAX" };
    return { range: "CUSTOM", from, to };
  }
  return { range: normalizedRange };
}

export type DividendType = "DIVIDENDO" | "JCP" | "OUTRO";

export interface DividendEvent {
  ticker: string;
  type: DividendType;
  /** Value per share/cota, in the instrument's currency. */
  rate: number;
  /** Ex-dividend ("data-com") date — the asset must be held by this date to receive the payment. */
  exDate: string | null;
  /** Date the payment is/was made. */
  paymentDate: string | null;
  /** Free-text description of what the payment refers to (e.g. "1º trimestre 2024"). */
  relatedTo: string | null;
}

export abstract class StockQuoteProvider {
  abstract fetchQuote(ticker: string): Promise<QuoteResult>;
  abstract fetchDetail(ticker: string): Promise<QuoteDetail>;
  /** Full B3 ticker list (stocks + FIIs) — used to power the "browse instead of type blind"
   *  asset picker. Large but changes rarely, so callers should cache it themselves. */
  abstract listCatalog(): Promise<CatalogEntry[]>;
  /** Price history for a given time range — a distinct, low-frequency lookup from fetchDetail's
   *  fixed 3-month window, so it isn't folded into the detail cache. */
  abstract fetchHistory(ticker: string, options: ChartRangeOptions): Promise<HistoricalPricePoint[]>;
  /** Dividend/JCP payment history for the dividend calendar. Stocks/FIIs only — crypto has no
   *  equivalent corporate action, so this isn't on CryptoQuoteProvider. */
  abstract fetchDividends(ticker: string): Promise<DividendEvent[]>;
}

export abstract class CryptoQuoteProvider {
  abstract fetchQuote(coinId: string): Promise<QuoteResult>;
  abstract fetchDetail(coinId: string): Promise<QuoteDetail>;
  /** Top coins by market cap — same idea as StockQuoteProvider.listCatalog(). */
  abstract listCatalog(): Promise<CatalogEntry[]>;
  abstract fetchHistory(coinId: string, options: ChartRangeOptions): Promise<HistoricalPricePoint[]>;
}

export abstract class EconomicIndicatorProvider {
  /** Current CDI rate, annualized, as a percentage (e.g. 10.75 for 10.75% a.a.). */
  abstract fetchAnnualCdiRate(): Promise<number>;
  /** IPCA accumulated over the last 12 months, as a percentage. */
  abstract fetchAnnualIpcaRate(): Promise<number>;
}
