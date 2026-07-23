import { Injectable } from "@nestjs/common";
import { FxQuote, TrackingFxRateProvider } from "../../domain/tracking-fx.provider";

/** Chrome's UA string — Yahoo's unofficial chart endpoint returns empty/blocked responses for
 *  obviously non-browser clients (bare curl, default fetch UA). Same trick already proven to work
 *  from this exact deployment in YahooDividendsProvider (investments module). */
const YAHOO_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const URL = "https://query1.finance.yahoo.com/v8/finance/chart/USDBRL=X?interval=1d&range=1d";

interface YahooChartResponse {
  chart: {
    result?: { meta?: { regularMarketPrice?: number; previousClose?: number; chartPreviousClose?: number } }[];
    error?: { code?: string; description?: string } | null;
  };
}

/**
 * Genuinely live FX quote (the same USD/BRL number Yahoo Finance's own site shows — not a once-a-day
 * snapshot like open.er-api.com/currency-api). AwesomeAPI (the primary) is closer to real-time too,
 * but its free tier sometimes rate-limits a VPS's IP with a 403/429; when that happens, falling
 * through straight to a daily-snapshot source made the ticker look "stuck" a full day behind (the
 * reported symptom this provider fixes). Placed ahead of the daily-snapshot fallbacks so a rate-limit
 * on AwesomeAPI doesn't immediately sacrifice freshness — those two stay only as the last resort if
 * Yahoo is also unreachable.
 */
@Injectable()
export class YahooFxProvider extends TrackingFxRateProvider {
  async fetchUsdToBrl(): Promise<FxQuote> {
    const res = await fetch(URL, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": YAHOO_USER_AGENT },
    });
    if (!res.ok) throw new Error(`Yahoo Finance USDBRL=X request failed: ${res.status}`);

    const body = (await res.json()) as YahooChartResponse;
    if (body.chart.error) throw new Error(`Yahoo Finance error for USDBRL=X: ${body.chart.error.description ?? body.chart.error.code}`);

    const meta = body.chart.result?.[0]?.meta;
    const rate = meta?.regularMarketPrice;
    if (!rate || Number.isNaN(rate) || rate <= 0) throw new Error("Yahoo Finance retornou uma cotação USD/BRL inválida.");

    // chartPreviousClose is the one reliably present on FX tickers (previousClose sometimes isn't).
    const previousClose = meta?.previousClose ?? meta?.chartPreviousClose ?? null;
    return { rate, previousClose };
  }
}
