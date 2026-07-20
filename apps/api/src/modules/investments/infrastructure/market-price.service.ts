import { Injectable, Logger } from "@nestjs/common";
import { InvestmentAssetClass } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { ChartRangeOptions, CryptoQuoteProvider, HistoricalPricePoint, AssetFundamentals, StockQuoteProvider } from "../domain/market-data.provider";

/** Short TTL so prices feel live without hammering the free-tier BRAPI/CoinGecko rate limits. */
const PRICE_TTL_MS = 5 * 60 * 1000;
/** History/fundamentals change far less often intraday, so they get a longer TTL. */
const DETAIL_TTL_MS = 30 * 60 * 1000;

export interface AssetQuoteDetail {
  price: number;
  currency: string;
  changePercent: number | null;
  history: HistoricalPricePoint[];
  fundamentals: AssetFundamentals;
  fetchedAt: Date;
  /** True when the price is a substitute for an instrument that can't be priced directly (e.g. a
   *  B3 fractional-lot ticker priced via its round-lot counterpart). */
  approximate: boolean;
}

/**
 * The only thing allowed to call StockQuoteProvider/CryptoQuoteProvider. Wraps every lookup in a
 * DB-backed TTL cache (InvestmentPriceCache) so the interface layer never hits an external API
 * directly, and a slow/unreachable provider never blocks a page load — a stale cached price (or
 * null, handled by the caller) is served instead.
 */
@Injectable()
export class MarketPriceService {
  private readonly logger = new Logger(MarketPriceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockProvider: StockQuoteProvider,
    private readonly cryptoProvider: CryptoQuoteProvider,
  ) {}

  /** Returns the last known price even if today's refresh failed, or null if never fetched. */
  async getPrice(
    assetClass: InvestmentAssetClass,
    symbol: string,
    options: { forceRefresh?: boolean } = {},
  ): Promise<{ price: number; approximate: boolean } | null> {
    const cached = await this.prisma.investmentPriceCache.findUnique({
      where: { symbol_assetClass: { symbol, assetClass } },
    });

    const isFresh = cached && !options.forceRefresh && Date.now() - cached.fetchedAt.getTime() < PRICE_TTL_MS;
    if (isFresh) return { price: Number(cached.price), approximate: cached.approximate };

    try {
      const quote = await this.fetchQuoteFromProvider(assetClass, symbol);
      await this.prisma.investmentPriceCache.upsert({
        where: { symbol_assetClass: { symbol, assetClass } },
        create: { symbol, assetClass, price: quote.price, currency: quote.currency, approximate: quote.approximate ?? false, source: this.sourceFor(assetClass) },
        update: { price: quote.price, currency: quote.currency, approximate: quote.approximate ?? false, fetchedAt: new Date(), source: this.sourceFor(assetClass) },
      });
      return { price: quote.price, approximate: quote.approximate ?? false };
    } catch (err) {
      this.logger.warn(`Quote refresh failed for ${assetClass} ${symbol}: ${(err as Error).message}`);
      return cached ? { price: Number(cached.price), approximate: cached.approximate } : null;
    }
  }

  /** Live price + change% + price history + fundamentals, for the asset detail page. Falls back
   *  to whatever is cached (even stale) if the provider is unreachable, rather than showing nothing. */
  async getDetail(assetClass: InvestmentAssetClass, symbol: string, options: { forceRefresh?: boolean } = {}): Promise<AssetQuoteDetail | null> {
    const cached = await this.prisma.investmentPriceCache.findUnique({
      where: { symbol_assetClass: { symbol, assetClass } },
    });

    const hasDetail = cached?.history !== null && cached?.history !== undefined;
    const isFresh = cached && hasDetail && !options.forceRefresh && Date.now() - cached.fetchedAt.getTime() < DETAIL_TTL_MS;
    if (isFresh) {
      return {
        price: Number(cached.price),
        currency: cached.currency,
        changePercent: cached.changePercent !== null ? Number(cached.changePercent) : null,
        history: (cached.history as unknown as HistoricalPricePoint[]) ?? [],
        fundamentals: (cached.fundamentals as AssetFundamentals) ?? {},
        fetchedAt: cached.fetchedAt,
        approximate: cached.approximate,
      };
    }

    try {
      const detail = await this.fetchDetailFromProvider(assetClass, symbol);
      const saved = await this.prisma.investmentPriceCache.upsert({
        where: { symbol_assetClass: { symbol, assetClass } },
        create: {
          symbol,
          assetClass,
          price: detail.price,
          currency: detail.currency,
          changePercent: detail.changePercent,
          approximate: detail.approximate ?? false,
          source: this.sourceFor(assetClass),
          history: detail.history as any,
          fundamentals: detail.fundamentals as any,
        },
        update: {
          price: detail.price,
          currency: detail.currency,
          changePercent: detail.changePercent,
          approximate: detail.approximate ?? false,
          fetchedAt: new Date(),
          source: this.sourceFor(assetClass),
          history: detail.history as any,
          fundamentals: detail.fundamentals as any,
        },
      });
      return {
        price: Number(saved.price),
        currency: saved.currency,
        changePercent: saved.changePercent !== null ? Number(saved.changePercent) : null,
        history: detail.history,
        fundamentals: detail.fundamentals,
        fetchedAt: saved.fetchedAt,
        approximate: saved.approximate,
      };
    } catch (err) {
      this.logger.warn(`Detail refresh failed for ${assetClass} ${symbol}: ${(err as Error).message}`);
      if (!cached) return null;
      return {
        price: Number(cached.price),
        currency: cached.currency,
        changePercent: cached.changePercent !== null ? Number(cached.changePercent) : null,
        history: (cached.history as unknown as HistoricalPricePoint[]) ?? [],
        fundamentals: (cached.fundamentals as AssetFundamentals) ?? {},
        fetchedAt: cached.fetchedAt,
        approximate: cached.approximate,
      };
    }
  }

  /** Price history for a user-chosen time range. Deliberately bypasses the price/detail caches —
   *  switching ranges is a distinct, infrequent user action, so it always fetches fresh from the
   *  provider for that specific range rather than piggybacking on the 30-minute detail cache
   *  (which only ever holds a fixed 3-month window). Falls back to an empty list on failure so a
   *  chart error never breaks the rest of the page. */
  async getHistory(assetClass: InvestmentAssetClass, symbol: string, options: ChartRangeOptions): Promise<HistoricalPricePoint[]> {
    try {
      if (assetClass === "CRYPTO") return await this.cryptoProvider.fetchHistory(symbol, options);
      return await this.stockProvider.fetchHistory(symbol, options);
    } catch (err) {
      this.logger.warn(`History fetch failed for ${assetClass} ${symbol} (${options.range}): ${(err as Error).message}`);
      return [];
    }
  }

  private fetchQuoteFromProvider(assetClass: InvestmentAssetClass, symbol: string) {
    if (assetClass === "CRYPTO") return this.cryptoProvider.fetchQuote(symbol);
    return this.stockProvider.fetchQuote(symbol);
  }

  private fetchDetailFromProvider(assetClass: InvestmentAssetClass, symbol: string) {
    if (assetClass === "CRYPTO") return this.cryptoProvider.fetchDetail(symbol);
    return this.stockProvider.fetchDetail(symbol);
  }

  private sourceFor(assetClass: InvestmentAssetClass) {
    return assetClass === "CRYPTO" ? "coingecko" : "brapi";
  }
}
