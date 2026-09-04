import { Injectable, Logger } from "@nestjs/common";
import { baseTickerFor } from "../../domain/fractional-ticker";
import { ChartRangeOptions, daysBetweenIsoDates, DividendEvent, HistoricalPricePoint } from "../../domain/market-data.provider";

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

interface YahooChartResult {
  /** Unix seconds, parallel to indicators.quote[0].close / indicators.adjclose[0].adjclose. */
  timestamp?: number[];
  indicators?: {
    quote?: { close?: (number | null)[] }[];
    /** Split/dividend-adjusted close — preferred over the raw close the same way BrapiProvider
     *  prefers adjustedClose, so a chart isn't discontinuous across a split. */
    adjclose?: { adjclose?: (number | null)[] }[];
  };
  events?: { dividends?: Record<string, YahooDividendEntry> };
}

interface YahooChartResponse {
  chart: {
    result?: YahooChartResult[];
    error?: { code?: string; description?: string } | null;
  };
}

/** Maps a ChartRange to Yahoo's range/interval query params — the same string values BRAPI's own
 *  brapiRangeParams (brapi.provider.ts) uses for the same tiers, since BRAPI's v2 API mirrors
 *  Yahoo's shape throughout (established elsewhere in this codebase). Unlike BRAPI's free plan,
 *  Yahoo's unofficial endpoint has no plan-tiered range restriction to work around — the 10y/1d
 *  combo used by fetchDividends already confirms ranges well beyond BRAPI's 3-month cap work here. */
function yahooRangeParams(options: ChartRangeOptions): { range: string; interval: string } {
  if (options.range === "CUSTOM") {
    const days = options.from && options.to ? daysBetweenIsoDates(options.from, options.to) : 365;
    if (days <= 90) return { range: "6mo", interval: "1d" };
    if (days <= 180) return { range: "1y", interval: "1d" };
    if (days <= 365) return { range: "2y", interval: "1d" };
    if (days <= 730) return { range: "5y", interval: "1d" };
    return { range: "max", interval: "1mo" };
  }
  switch (options.range) {
    case "3M":
      return { range: "3mo", interval: "1d" };
    case "6M":
      return { range: "6mo", interval: "1d" };
    case "12M":
      return { range: "1y", interval: "1d" };
    case "MAX":
    default:
      return { range: "max", interval: "1mo" };
  }
}

/**
 * Fallback source — dividends AND price history — for B3 stocks/FIIs BRAPI's free plan blocks.
 * Confirmed 2026-07-20: BRAPI 403s dividends for every stock beyond a couple of samples. Confirmed
 * 2026-07-26: BRAPI 403s /v2/stocks/statistics the same way outside its sample set, and separately
 * caps /v2/stocks/historical at a 3-month range on this plan regardless of ticker ("Ranges
 * permitidos: 1d, 5d, 1mo, 3mo" — 6M/12M/MAX and any custom range beyond 90 days all fail).
 *
 * Yahoo Finance has had no official public API since ~2017 — this hits the same unofficial
 * "/v8/finance/chart" endpoint tools like yfinance wrap under the hood, using the ".SA" suffix
 * Yahoo assigns B3 listings. Genuinely free with no plan/quota gate, but unsupported: Yahoo can
 * change or block this without notice, so callers only reach for it when the primary provider
 * (BRAPI) has already failed — never as the first attempt.
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
    const result = await this.fetchChartWithFallback(ticker, "events=div&interval=1d&range=10y");
    const dividends = result.events?.dividends ?? {};
    return Object.values(dividends).map((d) => ({
      ticker: ticker.toUpperCase(),
      type: "OUTRO" as const,
      rate: d.amount,
      exDate: new Date(d.date * 1000).toISOString().slice(0, 10),
      paymentDate: null,
      relatedTo: "Fonte: Yahoo Finance",
    }));
  }

  /** Same round-lot fallback as the other v2 endpoints. Custom ranges are sliced to the exact
   *  [from, to] window afterward, same as BrapiProvider — Yahoo has no arbitrary-range param. */
  async fetchHistory(ticker: string, options: ChartRangeOptions): Promise<HistoricalPricePoint[]> {
    const { range, interval } = yahooRangeParams(options);
    const result = await this.fetchChartWithFallback(ticker, `interval=${interval}&range=${range}`);

    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const adjCloses = result.indicators?.adjclose?.[0]?.adjclose ?? [];
    let history: HistoricalPricePoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = adjCloses[i] ?? closes[i];
      if (typeof close !== "number") continue;
      history.push({ date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10), close });
    }

    if (options.range === "CUSTOM" && options.from && options.to) {
      history = history.filter((p) => p.date >= options.from! && p.date <= options.to!);
    }
    return history;
  }

  private async fetchChartWithFallback(ticker: string, params: string): Promise<YahooChartResult> {
    try {
      return await this.fetchChart(ticker, params);
    } catch (err) {
      const base = baseTickerFor(ticker);
      if (!base) throw err;
      this.logger.warn(`No Yahoo Finance data for fractional ticker ${ticker}, falling back to ${base}: ${(err as Error).message}`);
      return this.fetchChart(base, params);
    }
  }

  private async fetchChart(ticker: string, params: string): Promise<YahooChartResult> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}.SA?${params}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": YAHOO_USER_AGENT },
    });
    if (!res.ok) throw new Error(`Yahoo Finance request failed for ${ticker}.SA: ${res.status}`);

    const body = (await res.json()) as YahooChartResponse;
    if (body.chart.error) throw new Error(`Yahoo Finance error for ${ticker}.SA: ${body.chart.error.description ?? body.chart.error.code}`);

    const result = body.chart.result?.[0];
    if (!result) throw new Error(`Yahoo Finance returned no result for ${ticker}.SA`);

    return result;
  }
}
