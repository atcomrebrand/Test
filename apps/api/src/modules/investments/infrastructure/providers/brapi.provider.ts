import { Injectable, Logger } from "@nestjs/common";
import { baseTickerFor } from "../../domain/fractional-ticker";
import {
  AssetFundamentals,
  CatalogEntry,
  ChartRangeOptions,
  DividendAssetClass,
  DividendEvent,
  DividendType,
  daysBetweenIsoDates,
  HistoricalPricePoint,
  QuoteDetail,
  QuoteResult,
  StockQuoteProvider,
} from "../../domain/market-data.provider";

interface BrapiHistoricalPoint {
  date: number; // unix seconds
  close?: number;
  adjustedClose?: number;
}

/** Fractional-lot tickers (e.g. BBSE3F) are priced/reported via their round-lot base ticker as a
 *  best-effort fallback — see fractional-ticker.ts for why. */

/** Maps a ChartRange to BRAPI's `range`/`interval` query params. CUSTOM requests the nearest
 *  enclosing bucket for the requested span (BRAPI has no arbitrary-range param) — the caller
 *  slices the result down to the exact dates afterward. MAX uses a coarser monthly interval to
 *  avoid asking for years of daily candles that just get downsampled by the chart anyway. */
function brapiRangeParams(options: ChartRangeOptions): { range: string; interval: string } {
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

interface BrapiCashDividend {
  rate?: number;
  paymentDate?: string;
  /** Ex-dividend ("data-com") date — BRAPI's field name for it. */
  lastDatePrior?: string;
  relatedTo?: string;
  label?: string;
}

/** Confirmed against a live call to /api/v2/stocks/quote with a real token (2026-07-20) — the v2
 *  quote payload nests fields under results[n].data instead of directly on results[n] like v1,
 *  and auth moved from a `?token=` query param to an `Authorization: Bearer` header. */
interface BrapiV2QuoteData {
  shortName?: string;
  longName?: string;
  currency?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  marketCap?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  logourl?: string;
}

interface BrapiV2Result {
  requestedSymbol?: string;
  symbol?: string;
  data?: BrapiV2QuoteData;
}

/** Confirmed against a live call to /api/v2/stocks/dividends with a real token (2026-07-20) — same
 *  cashDividends field names as v1's dividendsData.cashDividends (rate/paymentDate/lastDatePrior/
 *  relatedTo/label), just moved under results[0].data instead of results[0].dividendsData. Also
 *  exposes stockDividends (splits/groupings/bonus-share events) and subscriptions, unused for now.
 *  STOCKS ONLY — BRAPI rejects this endpoint for FII tickers with a 400 "FII_DIVIDENDS_MISUSE"
 *  pointing at /api/v2/fii/dividends instead (see BrapiV2FiiDividendsResponse below). */
interface BrapiV2DividendsData {
  cashDividends?: BrapiCashDividend[];
}

/** Confirmed against a live call to /api/v2/fii/dividends with a real token (2026-07-20) — same
 *  per-entry field names as the stocks endpoint (rate/paymentDate/lastDatePrior/relatedTo/label),
 *  but the entries sit directly under a top-level "dividends" array instead of
 *  results[0].data.cashDividends. FII-only; the stocks endpoint above rejects FII tickers and
 *  this one is presumably the mirror case (untested — no FII lookup ever needs the stocks shape). */
interface BrapiV2FiiDividendsResponse {
  dividends?: BrapiCashDividend[];
}

/** Confirmed against a live call to /api/v2/stocks/statistics with a real token (2026-07-20).
 *  Only the fields fetchDetail actually surfaces are declared — the real payload has many more
 *  (beta, bookValue, priceToBook, sharesOutstanding, etc.) the app has no use for yet. */
interface BrapiV2StatisticsData {
  trailingPE?: number;
  earningsPerShare?: number;
  dividendYield?: number;
}

/** Confirmed against a live call to /api/v2/stocks/historical with a real token (2026-07-20) —
 *  same historicalDataPrice shape as v1 (date/open/high/low/close/volume/adjustedClose), just
 *  nested under results[0].data alongside usedRange/usedInterval instead of sitting directly on
 *  results[0]. */
interface BrapiV2HistoricalData {
  historicalDataPrice?: BrapiHistoricalPoint[];
}

/** Confirmed against a live call to /api/v2/tickers with a real token (2026-07-20) — replaces
 *  v1's single-shot /api/quote/list. assetType is "stock" | "fund" | "bdr", same three values v1
 *  reported, so CatalogCacheService's existing `type === "fund"` FII filter needs no changes.
 *  Paginated (2310+ tickers total): requesting limit=1000 keeps the full catalog to 3 pages. */
interface BrapiV2TickerEntry {
  symbol?: string;
  name?: string;
  longName?: string;
  assetType?: string;
  logoUrl?: string;
}

interface BrapiV2TickersPage {
  results?: BrapiV2TickerEntry[];
  pagination?: { hasNextPage?: boolean };
}

function classifyDividendType(label: string | undefined): DividendType {
  const normalized = (label ?? "").toUpperCase();
  if (normalized.includes("JCP") || normalized.includes("JUROS")) return "JCP";
  if (normalized.includes("DIVIDENDO")) return "DIVIDENDO";
  return "OUTRO";
}

function normalizeBrapiDate(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/** brapi.dev — free-tier quote provider for B3 stocks/FIIs. Priority provider per spec. */
@Injectable()
export class BrapiProvider extends StockQuoteProvider {
  private readonly logger = new Logger(BrapiProvider.name);

  async fetchQuote(ticker: string): Promise<QuoteResult> {
    const { quote, approximate } = await this.fetchQuoteV2WithFractionalFallback(ticker);
    return { price: quote.regularMarketPrice as number, currency: quote.currency ?? "BRL", approximate };
  }

  /** v1 fetched quote + fundamentals + a 3-month history slice in one call via query-param
   *  "modules"; v2 splits those into three independent endpoints. Statistics and historical are
   *  best-effort here — a hiccup on either shouldn't take down the whole detail view when the
   *  quote itself (price, day range, 52-week range, market cap — all on the quote payload) is
   *  fine, so failures there fall back to just omitting that data instead of throwing. */
  async fetchDetail(ticker: string): Promise<QuoteDetail> {
    const { quote, approximate } = await this.fetchQuoteV2WithFractionalFallback(ticker);
    const statistics = await this.fetchStatisticsV2WithFallback(ticker).catch(() => null);
    const historicalData = await this.fetchHistoricalV2WithFallback(ticker, "3mo", "1d").catch(() => null);

    const history: HistoricalPricePoint[] = (historicalData?.historicalDataPrice ?? [])
      .filter((p) => typeof p.close === "number" || typeof p.adjustedClose === "number")
      .map((p) => ({
        date: new Date(p.date * 1000).toISOString().slice(0, 10),
        close: (p.adjustedClose ?? p.close) as number,
      }));

    const fundamentals: AssetFundamentals = {};
    const add = (label: string, value: number | string | null | undefined) => {
      if (value !== undefined && value !== null) fundamentals[label] = value;
    };
    add("Nome", quote.longName ?? quote.shortName ?? null);
    if (approximate) add("Aviso", "Preço aproximado — baseado no lote padrão, mercado fracionário não tem cotação própria disponível");
    add("Máxima 52 semanas", quote.fiftyTwoWeekHigh ?? null);
    add("Mínima 52 semanas", quote.fiftyTwoWeekLow ?? null);
    add("Máxima do dia", quote.regularMarketDayHigh ?? null);
    add("Mínima do dia", quote.regularMarketDayLow ?? null);
    add("Volume", quote.regularMarketVolume ?? null);
    add("Valor de mercado", quote.marketCap ?? null);
    add("P/L", statistics?.trailingPE ?? null);
    add("LPA", statistics?.earningsPerShare ?? null);
    add("Dividend Yield", statistics?.dividendYield ?? null);

    return {
      price: quote.regularMarketPrice as number,
      currency: quote.currency ?? "BRL",
      changePercent: quote.regularMarketChangePercent ?? null,
      history,
      fundamentals,
      approximate,
    };
  }

  /** Price history for a user-chosen time range. Not part of the 30-minute detail cache — range
   *  switching is a deliberate, infrequent action, so each call fetches fresh from BRAPI. Custom
   *  ranges request the nearest enclosing bucket BRAPI supports, then get sliced to the exact
   *  [from, to] window since BRAPI has no arbitrary-range parameter. */
  async fetchHistory(ticker: string, options: ChartRangeOptions): Promise<HistoricalPricePoint[]> {
    const { range, interval } = brapiRangeParams(options);
    const data = await this.fetchHistoricalV2WithFallback(ticker, range, interval);

    let history: HistoricalPricePoint[] = (data.historicalDataPrice ?? [])
      .filter((p) => typeof p.close === "number" || typeof p.adjustedClose === "number")
      .map((p) => ({
        date: new Date(p.date * 1000).toISOString().slice(0, 10),
        close: (p.adjustedClose ?? p.close) as number,
      }));

    if (options.range === "CUSTOM" && options.from && options.to) {
      history = history.filter((p) => p.date >= options.from! && p.date <= options.to!);
    }

    return history;
  }

  /** Dividend/JCP payment history via BRAPI v2's dedicated dividends endpoints — a separate one
   *  per instrument type (confirmed 2026-07-20: /api/v2/stocks/dividends rejects FII tickers
   *  outright with a 400 "FII_DIVIDENDS_MISUSE" pointing at /api/v2/fii/dividends instead). Falls
   *  back to the round-lot ticker only when the exact ticker's lookup fails outright (network/404)
   *  — an empty result for a ticker that *does* resolve is a legitimate answer ("never paid a
   *  dividend"), not a failure to retry. The payment per share is identical regardless of lot
   *  size, so there's no "approximate" flag to track here unlike the quote endpoint. */
  async fetchDividends(ticker: string, assetClass: DividendAssetClass): Promise<DividendEvent[]> {
    const cashDividends =
      assetClass === "FII"
        ? ((await this.fetchFiiDividendsV2WithFallback(ticker)).dividends ?? [])
        : ((await this.fetchDividendsV2WithFallback(ticker)).cashDividends ?? []);

    return cashDividends
      .filter((d): d is BrapiCashDividend & { rate: number } => typeof d.rate === "number")
      .map((d) => ({
        ticker: ticker.toUpperCase(),
        type: classifyDividendType(d.label),
        rate: d.rate,
        exDate: normalizeBrapiDate(d.lastDatePrior),
        paymentDate: normalizeBrapiDate(d.paymentDate),
        relatedTo: d.relatedTo ?? null,
      }));
  }

  /** Called once a day at most (CatalogCacheService's TTL) — 3 sequential requests at limit=1000
   *  is negligible at that rate. MAX_PAGES is a runaway guard, not a real limit: B3 has ~2310
   *  tickers today (3 pages), nowhere near the 20-page/20000-ticker ceiling here. */
  async listCatalog(): Promise<CatalogEntry[]> {
    const MAX_PAGES = 20;
    const entries: CatalogEntry[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const body = await this.fetchTickersPageV2(page);
      for (const e of body.results ?? []) {
        if (typeof e.symbol !== "string") continue;
        entries.push({ ticker: e.symbol, name: e.longName ?? e.name ?? e.symbol, type: e.assetType, logoUrl: e.logoUrl });
      }
      if (!body.pagination?.hasNextPage) break;
    }

    return entries;
  }

  private async fetchTickersPageV2(page: number): Promise<BrapiV2TickersPage> {
    const token = process.env.BRAPI_TOKEN;
    const url = `https://brapi.dev/api/v2/tickers?page=${page}&limit=1000`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`BRAPI v2 tickers request failed (page ${page}): ${res.status}`);
    return (await res.json()) as BrapiV2TickersPage;
  }

  /** Same "try exact ticker, fall back to the round lot" logic as the quote/dividends fallbacks,
   *  but against the v2 quote endpoint. */
  private async fetchQuoteV2WithFractionalFallback(ticker: string): Promise<{ quote: BrapiV2QuoteData; approximate: boolean }> {
    try {
      const quote = await this.fetchRawV2(ticker);
      if (typeof quote.regularMarketPrice === "number") return { quote, approximate: false };
      throw new Error(`BRAPI v2 returned no price for ${ticker}`);
    } catch (err) {
      const base = baseTickerFor(ticker);
      if (!base) throw err;
      this.logger.warn(`No direct v2 quote for fractional ticker ${ticker}, falling back to ${base}: ${(err as Error).message}`);
      const quote = await this.fetchRawV2(base);
      if (typeof quote.regularMarketPrice !== "number") throw new Error(`BRAPI v2 returned no quote for ${ticker} or ${base}`);
      return { quote, approximate: true };
    }
  }

  /** Falls back to the round-lot ticker only when the lookup itself fails — a successful lookup
   *  with empty arrays is a valid answer for the exact ticker, not a reason to retry. */
  private async fetchDividendsV2WithFallback(ticker: string): Promise<BrapiV2DividendsData> {
    try {
      return await this.fetchRawDividendsV2(ticker);
    } catch (err) {
      const base = baseTickerFor(ticker);
      if (!base) throw err;
      this.logger.warn(`No v2 dividends data for fractional ticker ${ticker}, falling back to ${base}: ${(err as Error).message}`);
      return this.fetchRawDividendsV2(base);
    }
  }

  private async fetchRawDividendsV2(ticker: string): Promise<BrapiV2DividendsData> {
    const token = process.env.BRAPI_TOKEN;
    const url = `https://brapi.dev/api/v2/stocks/dividends?symbols=${encodeURIComponent(ticker)}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error(`BRAPI v2 dividends request failed for ${ticker}: ${res.status}`);
    }
    const body = (await res.json()) as { results?: { data?: BrapiV2DividendsData }[] };
    const data = body.results?.[0]?.data;
    if (!data) throw new Error(`BRAPI v2 returned no dividends data for ${ticker}`);
    return data;
  }

  /** Same "lookup fails → fall back to round lot" rule as the stock dividends fallback above. */
  private async fetchFiiDividendsV2WithFallback(ticker: string): Promise<BrapiV2FiiDividendsResponse> {
    try {
      return await this.fetchRawFiiDividendsV2(ticker);
    } catch (err) {
      const base = baseTickerFor(ticker);
      if (!base) throw err;
      this.logger.warn(`No v2 FII dividends data for fractional ticker ${ticker}, falling back to ${base}: ${(err as Error).message}`);
      return this.fetchRawFiiDividendsV2(base);
    }
  }

  private async fetchRawFiiDividendsV2(ticker: string): Promise<BrapiV2FiiDividendsResponse> {
    const token = process.env.BRAPI_TOKEN;
    const url = `https://brapi.dev/api/v2/fii/dividends?symbols=${encodeURIComponent(ticker)}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error(`BRAPI v2 FII dividends request failed for ${ticker}: ${res.status}`);
    }
    return (await res.json()) as BrapiV2FiiDividendsResponse;
  }

  private async fetchRawV2(ticker: string): Promise<BrapiV2QuoteData> {
    const token = process.env.BRAPI_TOKEN;
    const url = `https://brapi.dev/api/v2/stocks/quote?symbols=${encodeURIComponent(ticker)}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error(`BRAPI v2 request failed for ${ticker}: ${res.status}`);
    }
    const body = (await res.json()) as { results?: BrapiV2Result[] };
    const data = body.results?.[0]?.data;
    if (!data) throw new Error(`BRAPI v2 returned no quote for ${ticker}`);
    return data;
  }

  /** Same "lookup fails → fall back to round lot" rule as dividends: the fundamentals ratios
   *  (P/L, LPA, dividend yield) are per-share and unaffected by lot size, so the base ticker's
   *  numbers are a fine substitute when the fractional ticker itself has no statistics entry. */
  private async fetchStatisticsV2WithFallback(ticker: string): Promise<BrapiV2StatisticsData> {
    try {
      return await this.fetchRawStatisticsV2(ticker);
    } catch (err) {
      const base = baseTickerFor(ticker);
      if (!base) throw err;
      this.logger.warn(`No v2 statistics data for fractional ticker ${ticker}, falling back to ${base}: ${(err as Error).message}`);
      return this.fetchRawStatisticsV2(base);
    }
  }

  private async fetchRawStatisticsV2(ticker: string): Promise<BrapiV2StatisticsData> {
    const token = process.env.BRAPI_TOKEN;
    const url = `https://brapi.dev/api/v2/stocks/statistics?symbols=${encodeURIComponent(ticker)}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error(`BRAPI v2 statistics request failed for ${ticker}: ${res.status}`);
    }
    const body = (await res.json()) as { results?: { data?: BrapiV2StatisticsData }[] };
    const data = body.results?.[0]?.data;
    if (!data) throw new Error(`BRAPI v2 returned no statistics data for ${ticker}`);
    return data;
  }

  /** Same round-lot fallback as the other v2 endpoints — a fractional ticker trades the same
   *  underlying instrument, so its price history is the base ticker's history when BRAPI has no
   *  fractional-specific series. */
  private async fetchHistoricalV2WithFallback(ticker: string, range: string, interval: string): Promise<BrapiV2HistoricalData> {
    try {
      return await this.fetchRawHistoricalV2(ticker, range, interval);
    } catch (err) {
      const base = baseTickerFor(ticker);
      if (!base) throw err;
      this.logger.warn(`No v2 historical data for fractional ticker ${ticker}, falling back to ${base}: ${(err as Error).message}`);
      return this.fetchRawHistoricalV2(base, range, interval);
    }
  }

  private async fetchRawHistoricalV2(ticker: string, range: string, interval: string): Promise<BrapiV2HistoricalData> {
    const token = process.env.BRAPI_TOKEN;
    const url = `https://brapi.dev/api/v2/stocks/historical?symbols=${encodeURIComponent(ticker)}&range=${range}&interval=${interval}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error(`BRAPI v2 historical request failed for ${ticker}: ${res.status}`);
    }
    const body = (await res.json()) as { results?: { data?: BrapiV2HistoricalData }[] };
    const data = body.results?.[0]?.data;
    if (!data) throw new Error(`BRAPI v2 returned no historical data for ${ticker}`);
    return data;
  }
}
