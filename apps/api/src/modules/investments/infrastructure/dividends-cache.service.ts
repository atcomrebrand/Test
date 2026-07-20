import { Injectable, Logger } from "@nestjs/common";
import { DividendAssetClass, DividendEvent, StockQuoteProvider } from "../domain/market-data.provider";

/** Corporate actions (dividends/JCP) are declared/paid at most a few times a year, so a day-long
 *  cache is safe and keeps a shared calendar view from re-fetching dozens of tickers on every
 *  request. In-memory only — losing it on restart just costs one extra fetch per ticker. */
const TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DividendsCacheService {
  private readonly logger = new Logger(DividendsCacheService.name);
  private readonly cache = new Map<string, { events: DividendEvent[]; fetchedAt: number }>();

  constructor(private readonly stockProvider: StockQuoteProvider) {}

  async get(ticker: string, assetClass: DividendAssetClass): Promise<DividendEvent[]> {
    const key = ticker.toUpperCase();
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.events;

    try {
      const events = await this.stockProvider.fetchDividends(key, assetClass);
      this.cache.set(key, { events, fetchedAt: Date.now() });
      return events;
    } catch (err) {
      this.logger.warn(`Dividend fetch failed for ${key}: ${(err as Error).message}`);
      return cached?.events ?? [];
    }
  }
}
