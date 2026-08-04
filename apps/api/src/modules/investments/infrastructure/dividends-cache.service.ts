import { Injectable, Logger } from "@nestjs/common";
import { DividendAssetClass, DividendEvent, StockQuoteProvider } from "../domain/market-data.provider";
import { FundamentusProvider } from "./providers/fundamentus.provider";
import { YahooDividendsProvider } from "./providers/yahoo-dividends.provider";

/** Corporate actions (dividends/JCP) are declared/paid at most a few times a year, so a day-long
 *  cache is safe and keeps a shared calendar view from re-fetching dozens of tickers on every
 *  request. In-memory only — losing it on restart just costs one extra fetch per ticker. */
const TTL_MS = 24 * 60 * 60 * 1000;

/** Also the resilience layer for dividend lookups, not just a cache. Source order when the primary
 *  (BRAPI) fails — most commonly its free plan's 403 on stock dividends beyond a couple of sample
 *  tickers:
 *
 *  1. Fundamentus — full event detail (data-com, payment date, DIVIDENDO/JCP split), same shape
 *     BRAPI provides, scraped from the same site the fundamentals fallback already fetches
 *     successfully in production.
 *  2. Yahoo Finance — sparse for B3 dividends (one undated-role date per event, no type), so it's
 *     the last resort, never tried before Fundamentus.
 *
 *  Neither fallback is ever tried first: BRAPI is the only supported/official-ish source. */
@Injectable()
export class DividendsCacheService {
  private readonly logger = new Logger(DividendsCacheService.name);
  private readonly cache = new Map<string, { events: DividendEvent[]; fetchedAt: number }>();

  constructor(
    private readonly stockProvider: StockQuoteProvider,
    private readonly fundamentusFallback: FundamentusProvider,
    private readonly yahooFallback: YahooDividendsProvider,
  ) {}

  async get(ticker: string, assetClass: DividendAssetClass): Promise<DividendEvent[]> {
    const key = ticker.toUpperCase();
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.events;

    try {
      const events = await this.stockProvider.fetchDividends(key, assetClass);
      this.cache.set(key, { events, fetchedAt: Date.now() });
      return events;
    } catch (err) {
      this.logger.warn(`Dividend fetch failed for ${key} via BRAPI, trying Fundamentus fallback: ${(err as Error).message}`);
    }

    try {
      const events = await this.fundamentusFallback.fetchProventos(key, assetClass);
      this.cache.set(key, { events, fetchedAt: Date.now() });
      return events;
    } catch (err) {
      this.logger.warn(`Fundamentus fallback failed for ${key}, trying Yahoo Finance: ${(err as Error).message}`);
    }

    try {
      const events = await this.yahooFallback.fetchDividends(key);
      this.cache.set(key, { events, fetchedAt: Date.now() });
      return events;
    } catch (err) {
      this.logger.warn(`Yahoo Finance fallback also failed for ${key}: ${(err as Error).message}`);
      return cached?.events ?? [];
    }
  }
}
