import { Injectable, Logger } from "@nestjs/common";
import { InvestmentAssetClass } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { CryptoQuoteProvider, StockQuoteProvider } from "../domain/market-data.provider";

const PRICE_TTL_MS = 15 * 60 * 1000;

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
  async getPrice(assetClass: InvestmentAssetClass, symbol: string): Promise<number | null> {
    const cached = await this.prisma.investmentPriceCache.findUnique({
      where: { symbol_assetClass: { symbol, assetClass } },
    });

    const isFresh = cached && Date.now() - cached.fetchedAt.getTime() < PRICE_TTL_MS;
    if (isFresh) return Number(cached.price);

    try {
      const quote = await this.fetchFromProvider(assetClass, symbol);
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

  private fetchFromProvider(assetClass: InvestmentAssetClass, symbol: string) {
    if (assetClass === "CRYPTO") return this.cryptoProvider.fetchQuote(symbol);
    return this.stockProvider.fetchQuote(symbol);
  }

  private sourceFor(assetClass: InvestmentAssetClass) {
    return assetClass === "CRYPTO" ? "coingecko" : "brapi";
  }
}
