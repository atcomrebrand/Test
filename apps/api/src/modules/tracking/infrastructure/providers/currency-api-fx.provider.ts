import { Injectable } from "@nestjs/common";
import { FxQuote, TrackingFxRateProvider } from "../../domain/tracking-fx.provider";

/** Third-tier FX fallback: static JSON served straight off a CDN (jsdelivr), with the project's own
 *  Cloudflare Pages mirror as a second try if jsdelivr itself is having a bad day. Unlike AwesomeAPI
 *  and open.er-api.com (both small free-tier APIs that sometimes block datacenter/cloud IP ranges —
 *  exactly the kind of network a production VPS runs on), this is just a static file behind a CDN,
 *  so there's no bot-detection/rate-limit logic to trip. Response shape:
 *  { date: "2026-07-23", usd: { brl: 5.43, ... 150+ other currencies ... } }. */
const PRIMARY_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json";
const MIRROR_URL = "https://latest.currency-api.pages.dev/v1/currencies/usd.json";

interface CurrencyApiResponse {
  usd?: { brl?: number };
}

@Injectable()
export class CurrencyApiFxProvider extends TrackingFxRateProvider {
  async fetchUsdToBrl(): Promise<FxQuote> {
    try {
      return await this.fetchFrom(PRIMARY_URL);
    } catch (err) {
      return await this.fetchFrom(MIRROR_URL).catch(() => {
        throw err;
      });
    }
  }

  private async fetchFrom(url: string): Promise<FxQuote> {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`currency-api request failed (${url}): ${res.status}`);

    const body = (await res.json()) as CurrencyApiResponse;
    const rate = body.usd?.brl;
    if (!rate || Number.isNaN(rate) || rate <= 0) throw new Error(`currency-api retornou uma cotação inválida (${url}).`);
    return { rate, previousClose: null };
  }
}
