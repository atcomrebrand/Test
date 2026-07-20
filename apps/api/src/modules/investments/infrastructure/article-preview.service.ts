import { Injectable, Logger } from "@nestjs/common";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { ArticlePreview } from "../domain/news.provider";

const TTL_MS = 60 * 60 * 1000;
const EMPTY_PREVIEW = (url: string): ArticlePreview => ({ title: null, description: null, imageUrl: null, siteName: null, url });

/** Fetches an article's own page and extracts its Open Graph tags — a real preview sourced from
 *  the publisher itself, used instead of embedding the site in an iframe (most Brazilian news
 *  sites block framing via X-Frame-Options, so an iframe would render blank for most sources). */
@Injectable()
export class ArticlePreviewService {
  private readonly logger = new Logger(ArticlePreviewService.name);
  private readonly cache = new Map<string, { preview: ArticlePreview; fetchedAt: number }>();

  async getPreview(link: string): Promise<ArticlePreview> {
    const cached = this.cache.get(link);
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.preview;

    if (!(await isSafePublicUrl(link))) {
      this.logger.warn(`Refused to fetch article preview for unsafe URL: ${link}`);
      return EMPTY_PREVIEW(link);
    }

    try {
      const res = await fetch(link, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ParcelasNewsBot/1.0)" },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`Article fetch failed: ${res.status}`);

      const finalUrl = res.url || link;
      const html = await res.text();

      const preview: ArticlePreview = {
        title: extractOgTag(html, "og:title") ?? extractTitleTag(html),
        description: extractOgTag(html, "og:description"),
        imageUrl: extractOgTag(html, "og:image"),
        siteName: extractOgTag(html, "og:site_name"),
        url: finalUrl,
      };
      this.cache.set(link, { preview, fetchedAt: Date.now() });
      return preview;
    } catch (err) {
      this.logger.warn(`Article preview failed for ${link}: ${(err as Error).message}`);
      return EMPTY_PREVIEW(link);
    }
  }
}

function extractOgTag(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let match = html.match(new RegExp(`<meta[^>]*property=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i"));
  if (!match) match = html.match(new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${escaped}["']`, "i"));
  return match ? decodeHtmlEntities(match[1]) : null;
}

function extractTitleTag(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeHtmlEntities(match[1].trim()) : null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** SSRF guard — this endpoint fetches a URL supplied by the client, so it must never be allowed to
 *  reach internal/private network addresses (cloud metadata endpoints, localhost, RFC1918 ranges,
 *  etc.), regardless of what domain name resolves there. */
async function isSafePublicUrl(rawUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (parsed.hostname === "localhost") return false;

  try {
    const version = isIP(parsed.hostname);
    if (version === 4) return !isPrivateIPv4(parsed.hostname);
    if (version === 6) return !isPrivateIPv6(parsed.hostname);

    const { address, family } = await lookup(parsed.hostname);
    return family === 4 ? !isPrivateIPv4(address) : !isPrivateIPv6(address);
  } catch {
    return false;
  }
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  if (lower.startsWith("fe80:")) return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("::ffff:")) {
    const embedded = lower.split(":").pop()!;
    if (embedded.includes(".")) return isPrivateIPv4(embedded);
  }
  return false;
}
