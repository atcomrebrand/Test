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

export abstract class StockQuoteProvider {
  abstract fetchQuote(ticker: string): Promise<QuoteResult>;
  abstract fetchDetail(ticker: string): Promise<QuoteDetail>;
  /** Full B3 ticker list (stocks + FIIs) — used to power the "browse instead of type blind"
   *  asset picker. Large but changes rarely, so callers should cache it themselves. */
  abstract listCatalog(): Promise<CatalogEntry[]>;
}

export abstract class CryptoQuoteProvider {
  abstract fetchQuote(coinId: string): Promise<QuoteResult>;
  abstract fetchDetail(coinId: string): Promise<QuoteDetail>;
  /** Top coins by market cap — same idea as StockQuoteProvider.listCatalog(). */
  abstract listCatalog(): Promise<CatalogEntry[]>;
}

export abstract class EconomicIndicatorProvider {
  /** Current CDI rate, annualized, as a percentage (e.g. 10.75 for 10.75% a.a.). */
  abstract fetchAnnualCdiRate(): Promise<number>;
  /** IPCA accumulated over the last 12 months, as a percentage. */
  abstract fetchAnnualIpcaRate(): Promise<number>;
}
