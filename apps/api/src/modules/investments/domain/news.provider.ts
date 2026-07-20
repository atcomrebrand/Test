/** Decoupled news provider contract — same reasoning as market-data.provider.ts: the interface
 *  layer never fetches news directly, always through NewsService (which adds caching), so the
 *  underlying source (Google News RSS today) can be swapped later without touching callers. */

export interface NewsArticle {
  title: string;
  link: string;
  source: string | null;
  /** ISO 8601 timestamp. */
  publishedAt: string;
  /** Short snippet from the RSS feed, when the feed actually carries one distinct from the title
   *  (Google News' <description> is often just the title re-wrapped in HTML, in which case this
   *  is null rather than showing a duplicate of the headline). */
  description: string | null;
}

export abstract class NewsProvider {
  abstract search(query: string, limit?: number): Promise<NewsArticle[]>;
}

/** Open Graph metadata scraped from an article's own page — used to render a real in-app preview
 *  popup instead of embedding the site in an iframe (most Brazilian financial news sites block
 *  framing via X-Frame-Options, so an iframe would just show blank/broken for most sources). */
export interface ArticlePreview {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  /** The final URL after following any redirects (Google News links redirect to the publisher). */
  url: string;
}
