import { Injectable, Logger } from "@nestjs/common";
import { FundamentusIndicators, parseFundamentusIndicators } from "../../domain/fundamentus-parser";
import { parseFundamentusProventos } from "../../domain/fundamentus-proventos-parser";
import { DividendAssetClass, DividendEvent } from "../../domain/market-data.provider";

/** Chrome's UA — same reasoning as YahooDividendsProvider: an obviously non-browser client can get
 *  blocked/served a stripped page. */
const FUNDAMENTUS_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Free, unofficial, no-auth source for the fundamentals BRAPI's free-tier /v2/stocks/statistics
 * doesn't return (ROE, ROA, margem bruta, PSR, liquidez corrente, dívida líquida/patrimônio) — see
 * fundamentus-parser.ts for the scraping/parsing details and its confirmed-live-fetch note. Stocks
 * only; MarketPriceService never calls this for FIIs (Fundamentus serves those from a different,
 * unverified page).
 *
 * The page is served as Latin-1/ISO-8859-1, not UTF-8 — confirmed by decoding it that way and
 * seeing correct accented Portuguese text (e.g. "Petróleo", "Patrim. Líq"); Node's fetch, unlike a
 * browser, does NOT read the page's own charset and always decodes .text() as UTF-8, which would
 * silently mangle every accented label this parser matches on. Reading the raw bytes and decoding
 * them explicitly as latin1 avoids that.
 */
@Injectable()
export class FundamentusProvider {
  private readonly logger = new Logger(FundamentusProvider.name);

  async fetchIndicators(ticker: string): Promise<FundamentusIndicators | null> {
    try {
      const url = `https://www.fundamentus.com.br/detalhes.php?papel=${encodeURIComponent(ticker)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": FUNDAMENTUS_USER_AGENT } });
      if (!res.ok) throw new Error(`Fundamentus request failed for ${ticker}: ${res.status}`);

      const html = Buffer.from(await res.arrayBuffer()).toString("latin1");
      if (!html.includes("Papel")) throw new Error(`Fundamentus returned no data for ${ticker}`);
      return parseFundamentusIndicators(html);
    } catch (err) {
      this.logger.warn(`No Fundamentus indicators for ${ticker}: ${(err as Error).message}`);
      return null;
    }
  }

  /** Per-event proventos (data-com, payment date, tipo, per-share value) — the same event-level
   *  detail the app gets from BRAPI when its free tier allows, which for most stocks it doesn't.
   *  Stocks and FIIs live on different Fundamentus pages with different table layouts (the parser
   *  resolves columns by header text, so either page's table parses correctly); the FII page is
   *  tried second for a FII ticker only if the stock-page URL yields nothing, since some units
   *  ("11" suffix but not FIIs) are served by the stock page. Throws on total failure so
   *  DividendsCacheService can fall through to the next source, mirroring how the BRAPI leg
   *  behaves there. */
  async fetchProventos(ticker: string, assetClass: DividendAssetClass): Promise<DividendEvent[]> {
    const key = ticker.toUpperCase();
    const urls = [`https://www.fundamentus.com.br/proventos.php?papel=${encodeURIComponent(key)}&tipo=2`];
    if (assetClass === "FII") urls.push(`https://www.fundamentus.com.br/fii_proventos.php?papel=${encodeURIComponent(key)}&tipo=2`);

    let lastError: Error | null = null;
    for (const url of urls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": FUNDAMENTUS_USER_AGENT } });
        if (!res.ok) throw new Error(`Fundamentus proventos request failed for ${key}: ${res.status}`);
        const html = Buffer.from(await res.arrayBuffer()).toString("latin1");
        const events = parseFundamentusProventos(html, key);
        if (events.length > 0) return events;
      } catch (err) {
        lastError = err as Error;
      }
    }
    throw lastError ?? new Error(`Fundamentus returned no proventos for ${key}`);
  }
}
