import { Injectable } from "@nestjs/common";
import { AssetRepository } from "../domain/asset.repository";
import { NewsArticle } from "../domain/news.provider";
import { NewsCacheService } from "../infrastructure/news-cache.service";

const MARKET_QUERY = "mercado financeiro OR bolsa de valores OR Ibovespa OR B3 investimentos";
/** Caps how many of the user's assets get their own search — a portfolio with 40 tickers
 *  shouldn't fire 40 RSS requests every 30 minutes. */
const MAX_ASSETS_QUERIED = 8;
const MAX_PORTFOLIO_ARTICLES = 20;

@Injectable()
export class NewsService {
  constructor(
    private readonly newsCache: NewsCacheService,
    private readonly assets: AssetRepository,
  ) {}

  getMarketNews(): Promise<NewsArticle[]> {
    return this.newsCache.search(MARKET_QUERY, 20);
  }

  /** News for just the tickers/coins the user actually owns — built from their portfolio, not a
   *  fixed query, so it stays relevant as their holdings change. */
  async getPortfolioNews(userId: string): Promise<NewsArticle[]> {
    const owned = await this.assets.findAllByUser(userId);
    if (owned.length === 0) return [];

    const queries = Array.from(new Set(owned.map((a) => a.name?.trim() || a.ticker))).slice(0, MAX_ASSETS_QUERIED);

    const results = await Promise.all(queries.map((q) => this.newsCache.search(q, 5)));
    const merged = new Map<string, NewsArticle>();
    for (const article of results.flat()) {
      if (!merged.has(article.link)) merged.set(article.link, article);
    }

    return Array.from(merged.values())
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, MAX_PORTFOLIO_ARTICLES);
  }
}
