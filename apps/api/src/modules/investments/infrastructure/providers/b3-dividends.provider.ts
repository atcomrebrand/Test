import { Injectable, Logger } from "@nestjs/common";
import { b3StockTypeForTicker, extractB3TradingName, parseB3CashDividends } from "../../domain/b3-dividends-parser";
import { baseTickerFor } from "../../domain/fractional-ticker";
import { DividendEvent } from "../../domain/market-data.provider";

/** Same browser UA the other scraping-adjacent providers send — B3's proxy is public and unkeyed,
 *  but an obviously non-browser client is the classic reason for a gratuitous block. */
const B3_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const BASE_URL = "https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall";

/** B3's proxy takes its query as a base64-encoded JSON path segment — the same convention the
 *  listed-companies pages on b3.com.br themselves use when calling it. */
function encodeParams(params: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(params)).toString("base64");
}

/**
 * Official-infrastructure dividend source: the same public endpoints B3's own listed-companies
 * site is served by. Two-step per company — resolve the ticker root (ITSA4 → "ITSA") to the
 * company's tradingName, then list its cash dividends — with the mapping memoized for the process
 * lifetime, since a company's identity doesn't change. Stocks only: FIIs live on a different B3
 * proxy, and BRAPI's dedicated FII dividends route already works reliably for those.
 *
 * The listing has no payment date (B3 announces those separately), so its events carry
 * paymentDate: null — richer sources (BRAPI/Fundamentus) stay ahead of it in the fallback chain,
 * and it exists to beat Yahoo's undated/untyped events when those two fail. Throws on any failure
 * so DividendsCacheService falls through, same contract as the other legs.
 */
@Injectable()
export class B3DividendsProvider {
  private readonly logger = new Logger(B3DividendsProvider.name);
  private readonly tradingNameByRoot = new Map<string, string>();

  async fetchDividends(ticker: string): Promise<DividendEvent[]> {
    // Fractional-lot tickers (BBSE3F) fall back to their round-lot base, same as every provider.
    const normalized = baseTickerFor(ticker) ?? ticker.toUpperCase();
    const typed = b3StockTypeForTicker(normalized);
    if (!typed) throw new Error(`B3 dividends: unsupported ticker shape ${ticker}`);

    const tradingName = await this.resolveTradingName(typed.root);
    const payload = await this.fetchJson(
      `${BASE_URL}/GetListedCashDividends/${encodeParams({ language: "pt-br", pageNumber: 1, pageSize: 120, tradingName })}`,
    );

    const events = parseB3CashDividends(payload, normalized);
    if (events.length === 0) throw new Error(`B3 returned no cash dividends for ${normalized} (${tradingName})`);
    return events;
  }

  private async resolveTradingName(root: string): Promise<string> {
    const cached = this.tradingNameByRoot.get(root);
    if (cached) return cached;

    const payload = await this.fetchJson(
      `${BASE_URL}/GetInitialCompanies/${encodeParams({ language: "pt-br", pageNumber: 1, pageSize: 20, company: root })}`,
    );
    const tradingName = extractB3TradingName(payload, root);
    if (!tradingName) throw new Error(`B3 company lookup found no issuingCompany ${root}`);

    this.tradingNameByRoot.set(root, tradingName);
    return tradingName;
  }

  private async fetchJson(url: string): Promise<unknown> {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": B3_USER_AGENT, Accept: "application/json" } });
    if (!res.ok) throw new Error(`B3 request failed: ${res.status}`);
    return res.json();
  }
}
