import { Injectable, Logger } from "@nestjs/common";
import { baseTickerFor } from "../../domain/fractional-ticker";
import { DividendEvent } from "../../domain/market-data.provider";

/** Chrome's UA string — Yahoo's unofficial chart endpoint returns empty/blocked responses for
 *  obviously non-browser clients (bare curl, default fetch UA). */
const YAHOO_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface YahooDividendEntry {
  /** Value per share, in the listing's local currency (BRL for a .SA ticker). */
  amount: number;
  /** Unix seconds. Yahoo reports one date per dividend — no separate ex-date/payment-date split
   *  the way BRAPI has, so this is used as-is for both roles rather than guessing which one it
   *  actually is. */
  date: number;
}

interface YahooChartResponse {
  chart: {
    result?: { events?: { dividends?: Record<string, YahooDividendEntry> } }[];
    error?: { code?: string; description?: string } | null;
  };
}

/**
 * Fallback dividend source for B3 stocks BRAPI's free plan blocks (confirmed 2026-07-20: BRAPI
 * returns a 403 "FEATURE_NOT_AVAILABLE" for dividends on every stock beyond a couple of samples).
 * Yahoo Finance has had no official public API since ~2017 — this hits the same unofficial
 * "/v8/finance/chart" endpoint tools like yfinance wrap under the hood, using the ".SA" suffix
 * Yahoo assigns B3 listings. Genuinely free with no plan/quota gate, but unsupported: Yahoo can
 * change or block this without notice, so DividendsCacheService only reaches for it when the
 * primary provider (BRAPI) has already failed — never as the first attempt.
 *
 * Confirmed against a live call for BBAS3.SA (2026-07-20): 71 dividend entries returned, each
 * `{ amount, date }` keyed by the same unix timestamp under chart.result[0].events.dividends. No
 * dividend-vs-JCP classification and no ex-date/payment-date split exist in this data, so every
 * entry is recorded as type "OUTRO" using its one date for both roles — reporting it as a specific
 * DIVIDENDO or JCP, or inventing a separate payment date, would be presenting a guess as fact.
 */
@Injectable()
export class YahooDividendsProvider {
  private readonly logger = new Logger(YahooDividendsProvider.name);

  /** Labels results with the originally-requested ticker even on a fractional-lot fallback —
   *  same convention BrapiProvider uses — so the raw fetch/fallback below only decides which
   *  symbol supplies the numbers, never what the result claims to be about. */
  async fetchDividends(ticker: string): Promise<DividendEvent[]> {
    const dividends = await this.fetchWithFallback(ticker);
    return Object.values(dividends).map((d) => ({
      ticker: ticker.toUpperCase(),
      type: "OUTRO" as const,
      rate: d.amount,
      exDate: new Date(d.date * 1000).toISOString().slice(0, 10),
      paymentDate: null,
      relatedTo: "Fonte: Yahoo Finance",
    }));
  }

  private async fetchWithFallback(ticker: string): Promise<Record<string, YahooDividendEntry>> {
    try {
      return await this.fetchRaw(ticker);
    } catch (err) {
      const base = baseTickerFor(ticker);
      if (!base) throw err;
      this.logger.warn(`No Yahoo Finance dividends data for fractional ticker ${ticker}, falling back to ${base}: ${(err as Error).message}`);
      return this.fetchRaw(base);
    }
  }

  private async fetchRaw(ticker: string): Promise<Record<string, YahooDividendEntry>> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}.SA?events=div&interval=1d&range=10y`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": YAHOO_USER_AGENT },
    });
    if (!res.ok) throw new Error(`Yahoo Finance request failed for ${ticker}.SA: ${res.status}`);

    const body = (await res.json()) as YahooChartResponse;
    if (body.chart.error) throw new Error(`Yahoo Finance error for ${ticker}.SA: ${body.chart.error.description ?? body.chart.error.code}`);

    const result = body.chart.result?.[0];
    if (!result) throw new Error(`Yahoo Finance returned no result for ${ticker}.SA`);

    return result.events?.dividends ?? {};
  }
}
