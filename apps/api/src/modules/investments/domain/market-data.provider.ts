/**
 * Decoupled market-data provider contracts. The interface layer (controllers) must never call
 * these directly — always go through MarketPriceService/EconomicIndicatorService, which add
 * caching. Swapping BRAPI for Alpha Vantage/Finnhub later only means writing a new class here.
 */

export interface QuoteResult {
  price: number;
  currency: string;
}

export abstract class StockQuoteProvider {
  abstract fetchQuote(ticker: string): Promise<QuoteResult>;
}

export abstract class CryptoQuoteProvider {
  abstract fetchQuote(coinId: string): Promise<QuoteResult>;
}

export abstract class EconomicIndicatorProvider {
  /** Current CDI rate, annualized, as a percentage (e.g. 10.75 for 10.75% a.a.). */
  abstract fetchAnnualCdiRate(): Promise<number>;
  /** IPCA accumulated over the last 12 months, as a percentage. */
  abstract fetchAnnualIpcaRate(): Promise<number>;
}
