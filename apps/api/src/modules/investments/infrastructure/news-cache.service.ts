import { Injectable, Logger } from "@nestjs/common";
import { NewsArticle, NewsProvider } from "../domain/news.provider";

const TTL_MS = 30 * 60 * 1000;

/** In-memory TTL cache in front of NewsProvider, keyed by query — headlines don't need a DB table
 *  (losing the cache on restart just means one extra RSS fetch), and 30 minutes keeps repeated
 *  dashboard/news-page visits from hammering Google News. Falls back to a stale cached entry (or
 *  an empty list) if the provider is unreachable, matching every other resilience pattern here. */
@Injectable()
export class NewsCacheService {
  private readonly logger = new Logger(NewsCacheService.name);
  private readonly cache = new Map<string, { articles: NewsArticle[]; fetchedAt: number }>();

  constructor(private readonly provider: NewsProvider) {}

  async search(query: string, limit = 15): Promise<NewsArticle[]> {
    const cached = this.cache.get(query);
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.articles;

    try {
      const articles = await this.provider.search(query, limit);
      this.cache.set(query, { articles, fetchedAt: Date.now() });
      return articles;
    } catch (err) {
      this.logger.warn(`News search failed for "${query}": ${(err as Error).message}`);
      return cached?.articles ?? [];
    }
  }
}
