import { Injectable, Logger } from "@nestjs/common";
import { InvestmentAssetClass } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  AdvancedFundamentals,
  ChartRangeOptions,
  CryptoQuoteProvider,
  HistoricalPricePoint,
  AssetFundamentals,
  StockQuoteProvider,
} from "../domain/market-data.provider";

/** Short TTL so prices feel live without hammering the free-tier BRAPI/CoinGecko rate limits. */
const PRICE_TTL_MS = 5 * 60 * 1000;
/** History/fundamentals change far less often intraday, so they get a longer TTL. */
const DETAIL_TTL_MS = 30 * 60 * 1000;
/** Balanços/DRE only change quarterly at most — a long TTL keeps the heavier multi-module lookup
 *  from ever running more than once every few hours per ticker. */
const ADVANCED_FUNDAMENTALS_TTL_MS = 6 * 60 * 60 * 1000;

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

  /** Indicadores/checklist-grade fundamentals (P/VP, ROE, ROA, margens, payout, balanço/DRE
   *  histórico) — stocks/FIIs only, crypto has no equivalent. Cached separately from the basic
   *  `fundamentals` blob on a much longer TTL since this is a heavier multi-module lookup and the
   *  underlying data (quarterly financials) barely changes day to day. Returns null on total
   *  failure with nothing cached yet — the caller shows "indisponível" instead of crashing.
   *  Callers should call getDetail() for this symbol first (AssetAnalysisService always does) so
   *  the cache row already exists with a real price before this ever needs to create one itself. */
  async getAdvancedFundamentals(symbol: string, options: { forceRefresh?: boolean } = {}): Promise<AdvancedFundamentals | null> {
    const assetClass: InvestmentAssetClass = "STOCK";
    const cached = await this.prisma.investmentPriceCache.findUnique({ where: { symbol_assetClass: { symbol, assetClass } } });

    const isFresh =
      cached?.advancedFundamentals &&
      cached.advancedFundamentalsAt &&
      !options.forceRefresh &&
      Date.now() - cached.advancedFundamentalsAt.getTime() < ADVANCED_FUNDAMENTALS_TTL_MS;
    if (isFresh) return cached.advancedFundamentals as unknown as AdvancedFundamentals;

    try {
      const data = await this.stockProvider.fetchAdvancedFundamentals(symbol);
      if (!data) return (cached?.advancedFundamentals as unknown as AdvancedFundamentals) ?? null;
      await this.prisma.investmentPriceCache.upsert({
        where: { symbol_assetClass: { symbol, assetClass } },
        create: { symbol, assetClass, price: 0, currency: "BRL", source: "brapi", advancedFundamentals: data as any, advancedFundamentalsAt: new Date() },
        update: { advancedFundamentals: data as any, advancedFundamentalsAt: new Date() },
      });
      return data;
    } catch (err) {
      this.logger.warn(`Advanced fundamentals refresh failed for ${symbol}: ${(err as Error).message}`);
      return (cached?.advancedFundamentals as unknown as AdvancedFundamentals) ?? null;
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
