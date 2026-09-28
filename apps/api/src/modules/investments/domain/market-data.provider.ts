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

/** BRAPI splits dividend data into distinct endpoints per instrument type (confirmed 2026-07-20:
 *  stocks return a "FII_DIVIDENDS_MISUSE" 400 pointing at the dedicated FII endpoint instead of
 *  serving the request), so every dividend lookup needs to know which one it's dealing with. */
export type DividendAssetClass = "STOCK" | "FII";

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

export interface AnnualIncomeEntry {
  year: number;
  netIncome: number;
}

/** Current-snapshot ratios beyond the basic P/L, LPA and dividend yield already in
 *  AssetFundamentals — powers the "Indicadores" and part of the "Checklist" sections. Every field
 *  is best-effort: the advanced BRAPI modules this comes from may not be available on every plan,
 *  so a null here means "couldn't get it," not "the company has none." */
export interface AdvancedIndicators {
  priceToBook: number | null; // P/VP
  returnOnEquity: number | null; // ROE, %
  returnOnAssets: number | null; // ROA, %
  profitMargins: number | null; // margem líquida, %
  grossMargins: number | null; // margem bruta, %
  payoutRatio: number | null; // %
  currentRatio: number | null; // liquidez corrente
  debtToEquity: number | null; // dívida líquida / patrimônio
  priceToSales: number | null; // PSR
  bookValuePerShare: number | null; // VPA — feeds Graham
  /** P/L, LPA, Dividend Yield — normally read off the basic quote-detail fundamentals blob, but
   *  that comes from the same BRAPI statistics endpoint that 403s outside its free-plan ticker
   *  sample, so these back it up when that basic fetch also came back empty. */
  peRatio: number | null; // P/L
  eps: number | null; // LPA — feeds Graham
  dividendYield: number | null; // %
}

export interface AdvancedFundamentals {
  indicators: AdvancedIndicators;
  /** Annual net income history, oldest first. Null when the module wasn't available at all
   *  (distinct from an empty array, which would mean "available but genuinely no history"). */
  annualNetIncome: AnnualIncomeEntry[] | null;
  /** Quarterly net income history, oldest first — used for the "20 quarters of profit" checklist
   *  item, which annual data alone can't answer. */
  quarterlyNetIncome: number[] | null;
  totalLiabilities: number | null;
  totalStockholderEquity: number | null;
  /** Trailing-twelve-months net income — a same-day snapshot, not a history, so it can only answer
   *  a much weaker "profitable recently" question, used as a fallback when quarterlyNetIncome (the
   *  real multi-year series) isn't available at all. */
  recentNetIncome: number | null;
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
   *  equivalent corporate action, so this isn't on CryptoQuoteProvider. assetClass picks which
   *  BRAPI endpoint serves the request — see DividendAssetClass. */
  abstract fetchDividends(ticker: string, assetClass: DividendAssetClass): Promise<DividendEvent[]>;
  /** Indicadores/checklist-grade fundamentals — a separate, heavier lookup from fetchDetail (more
   *  modules, more likely to hit a plan limit), so callers should treat a failure here as "show
   *  what we have" rather than losing the whole detail page over it. Returns null wholesale when
   *  even the base request fails; individual fields inside a successful response are still
   *  independently nullable when only part of the payload came back. */
  abstract fetchAdvancedFundamentals(ticker: string): Promise<AdvancedFundamentals | null>;
}

export abstract class CryptoQuoteProvider {
  abstract fetchQuote(coinId: string): Promise<QuoteResult>;
  abstract fetchDetail(coinId: string): Promise<QuoteDetail>;
  /** Top coins by market cap — same idea as StockQuoteProvider.listCatalog(). */
  abstract listCatalog(): Promise<CatalogEntry[]>;
  abstract fetchHistory(coinId: string, options: ChartRangeOptions): Promise<HistoricalPricePoint[]>;
}

/** Uma linha da série diária do CDI: a taxa que valeu naquele dia útil, em % ao dia. */
export interface DailyRatePoint {
  /** Dia útil, à meia-noite UTC — a série do Bacen não tem hora. */
  date: Date;
  /** % ao dia, como o Bacen publica (ex.: 0.055131 = 0,055131%). */
  value: number;
}

export abstract class EconomicIndicatorProvider {
  /** Current CDI rate, annualized, as a percentage (e.g. 10.75 for 10.75% a.a.). */
  abstract fetchAnnualCdiRate(): Promise<number>;
  /** IPCA accumulated over the last 12 months, as a percentage. */
  abstract fetchAnnualIpcaRate(): Promise<number>;
  /** Meta Selic ao ano — usada só pela poupança do simulador, que é a única conta do app que
   *  depende dela em vez do CDI. */
  abstract fetchAnnualSelicRate(): Promise<number>;
  /** As três taxas anuais, com `null` na que a fonte não entregou. Existe pro simulador poder
   *  dizer na tela que projetou em cima de um valor de reserva. */
  abstract fetchAnnualRatesOrNull(): Promise<{ cdi: number | null; ipca: number | null; selic: number | null }>;
  /**
   * Série diária do CDI no intervalo [from, to], só dias úteis. É com ela que dá pra chegar no
   * mesmo número do banco: cada dia rende a taxa que valeu naquele dia, e feriado/fim de semana
   * ficam de fora por não estarem na série. Devolve `null` quando a fonte não respondeu — aí o
   * chamador cai na taxa anual, que é aproximada.
   */
  abstract fetchDailyCdiSeries(from: Date, to: Date): Promise<DailyRatePoint[] | null>;
}
