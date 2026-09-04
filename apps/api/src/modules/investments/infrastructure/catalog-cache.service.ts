import { Injectable, Logger } from "@nestjs/common";
import { InvestmentAssetClass } from "@prisma/client";
import { CatalogEntry, CryptoQuoteProvider, StockQuoteProvider } from "../domain/market-data.provider";

/** B3's ticker list barely changes; CoinGecko's top-250 shuffles a bit more (new listings). */
const STOCK_CATALOG_TTL_MS = 24 * 60 * 60 * 1000;
const CRYPTO_CATALOG_TTL_MS = 60 * 60 * 1000;
const MAX_RESULTS = 25;

/** In-memory cache for the two catalog lists — no DB table needed since losing it on restart just
 *  means one extra fetch. The interface layer only ever calls search(), never the providers. */
@Injectable()
export class CatalogCacheService {
  private readonly logger = new Logger(CatalogCacheService.name);
  private stocks: { entries: CatalogEntry[]; fetchedAt: number } | null = null;
  private crypto: { entries: CatalogEntry[]; fetchedAt: number } | null = null;

  constructor(
    private readonly stockProvider: StockQuoteProvider,
    private readonly cryptoProvider: CryptoQuoteProvider,
  ) {}

  async search(assetClass: InvestmentAssetClass, query: string): Promise<CatalogEntry[]> {
    const entries = assetClass === "CRYPTO" ? await this.getCryptoCatalog() : await this.getStockCatalog(assetClass);
    const normalizedQuery = query.trim().toUpperCase();
    if (!normalizedQuery) return entries.slice(0, MAX_RESULTS);

    return entries
      .filter((e) => e.ticker.toUpperCase().includes(normalizedQuery) || e.name.toUpperCase().includes(normalizedQuery))
      .slice(0, MAX_RESULTS);
  }

  private async getStockCatalog(assetClass: "STOCK" | "FII" | "FUND"): Promise<CatalogEntry[]> {
    const isFresh = this.stocks && Date.now() - this.stocks.fetchedAt < STOCK_CATALOG_TTL_MS;
    if (!isFresh) {
      try {
        const entries = await this.stockProvider.listCatalog();
        this.stocks = { entries, fetchedAt: Date.now() };
      } catch (err) {
        this.logger.warn(`Stock catalog refresh failed: ${(err as Error).message}`);
        if (!this.stocks) return [];
      }
    }

    const all = this.stocks?.entries ?? [];
    if (assetClass === "FII") return all.filter((e) => e.type === "fund");
    return all.filter((e) => e.type !== "fund");
  }

  private async getCryptoCatalog(): Promise<CatalogEntry[]> {
    const isFresh = this.crypto && Date.now() - this.crypto.fetchedAt < CRYPTO_CATALOG_TTL_MS;
    if (!isFresh) {
      try {
        const entries = await this.cryptoProvider.listCatalog();
        this.crypto = { entries, fetchedAt: Date.now() };
      } catch (err) {
        this.logger.warn(`Crypto catalog refresh failed: ${(err as Error).message}`);
        if (!this.crypto) return [];
      }
    }
    return this.crypto?.entries ?? [];
  }
}
