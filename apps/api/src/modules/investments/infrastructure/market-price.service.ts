import { Injectable, Logger } from "@nestjs/common";
import { InvestmentAssetClass } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { CryptoQuoteProvider, HistoricalPricePoint, AssetFundamentals, StockQuoteProvider } from "../domain/market-data.provider";

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
  async getPrice(assetClass: InvestmentAssetClass, symbol: string, options: { forceRefresh?: boolean } = {}): Promise<number | null> {
    const cached = await this.prisma.investmentPriceCache.findUnique({
      where: { symbol_assetClass: { symbol, assetClass } },
    });

    const isFresh = cached && !options.forceRefresh && Date.now() - cached.fetchedAt.getTime() < PRICE_TTL_MS;
    if (isFresh) return Number(cached.price);

    try {
      const quote = await this.fetchQuoteFromProvider(assetClass, symbol);
      await this.prisma.investmentPriceCache.upsert({
        where: { symbol_assetClass: { symbol, assetClass } },
        create: { symbol, assetClass, price: quote.price, currency: quote.currency, source: this.sourceFor(assetClass) },
        update: { price: quote.price, currency: quote.currency, fetchedAt: new Date(), source: this.sourceFor(assetClass) },
      });
      return quote.price;
    } catch (err) {
      this.logger.warn(`Quote refresh failed for ${assetClass} ${symbol}: ${(err as Error).message}`);
      return cached ? Number(cached.price) : null;
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
          source: this.sourceFor(assetClass),
          history: detail.history as any,
          fundamentals: detail.fundamentals as any,
        },
        update: {
          price: detail.price,
          currency: detail.currency,
          changePercent: detail.changePercent,
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
      };
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
