import { Injectable } from "@nestjs/common";
import { NewsArticle, NewsProvider } from "../../domain/news.provider";

/** Google News RSS — free, no API key required. Deliberately parsed with a small hand-written
 *  regex extractor instead of pulling in an XML-parsing dependency for what's a handful of
 *  well-known, stable tag shapes (<item>, <title>, <link>, <pubDate>, <source>). */
@Injectable()
export class GoogleNewsProvider extends NewsProvider {
  async search(query: string, limit = 15): Promise<NewsArticle[]> {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Google News RSS request failed for "${query}": ${res.status}`);

    const xml = await res.text();
    return extractItems(xml)
      .slice(0, limit)
      .map(parseItem)
      .filter((article): article is NewsArticle => article !== null);
  }
}

function extractItems(xml: string): string[] {
  return xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
}

function extractTag(item: string, tag: string): string | null {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  if (!match) return null;
  return decodeXmlEntities(stripCdata(match[1].trim()));
}

function stripCdata(value: string): string {
  const match = value.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  return match ? match[1] : value;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Google News titles are formatted "Headline - Source Name" — the dedicated <source> tag is
 *  used to strip that suffix back off when present, so the UI shows a clean headline. */
function parseItem(item: string): NewsArticle | null {
  const rawTitle = extractTag(item, "title");
  const link = extractTag(item, "link");
  if (!rawTitle || !link) return null;

  const source = extractTag(item, "source");
  const pubDate = extractTag(item, "pubDate");
  const publishedAt = pubDate && !Number.isNaN(Date.parse(pubDate)) ? new Date(pubDate).toISOString() : new Date().toISOString();

  const title = source && rawTitle.endsWith(` - ${source}`) ? rawTitle.slice(0, rawTitle.length - source.length - 3) : rawTitle;

  return { title, link, source, publishedAt };
}
