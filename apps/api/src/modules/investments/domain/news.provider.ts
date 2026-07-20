/** Decoupled news provider contract — same reasoning as market-data.provider.ts: the interface
 *  layer never fetches news directly, always through NewsService (which adds caching), so the
 *  underlying source (Google News RSS today) can be swapped later without touching callers. */

export interface NewsArticle {
  title: string;
  link: string;
  source: string | null;
  /** ISO 8601 timestamp. */
  publishedAt: string;
}

export abstract class NewsProvider {
  abstract search(query: string, limit?: number): Promise<NewsArticle[]>;
}
