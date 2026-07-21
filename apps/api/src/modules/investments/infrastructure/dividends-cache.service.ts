import { Injectable, Logger } from "@nestjs/common";
import { DividendAssetClass, DividendEvent, StockQuoteProvider } from "../domain/market-data.provider";
import { YahooDividendsProvider } from "./providers/yahoo-dividends.provider";

/** Corporate actions (dividends/JCP) are declared/paid at most a few times a year, so a day-long
 *  cache is safe and keeps a shared calendar view from re-fetching dozens of tickers on every
 *  request. In-memory only — losing it on restart just costs one extra fetch per ticker. */
const TTL_MS = 24 * 60 * 60 * 1000;

/** Also the resilience layer for dividend lookups, not just a cache: when the primary provider
 *  (BRAPI) fails — most commonly its free plan's 403 on stock dividends beyond a couple of sample
 *  tickers — this retries via Yahoo Finance before giving up. Never the other way around: Yahoo
 *  is unsupported/unofficial, so it's only ever a fallback, never tried first. */
@Injectable()
export class DividendsCacheService {
  private readonly logger = new Logger(DividendsCacheService.name);
  private readonly cache = new Map<string, { events: DividendEvent[]; fetchedAt: number }>();

  constructor(
    private readonly stockProvider: StockQuoteProvider,
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
      this.logger.warn(`Dividend fetch failed for ${key} via BRAPI, trying Yahoo Finance fallback: ${(err as Error).message}`);
      try {
        const events = await this.yahooFallback.fetchDividends(key);
        this.cache.set(key, { events, fetchedAt: Date.now() });
        return events;
      } catch (fallbackErr) {
        this.logger.warn(`Yahoo Finance fallback also failed for ${key}: ${(fallbackErr as Error).message}`);
        return cached?.events ?? [];
      }
    }
  }
}
