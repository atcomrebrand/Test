import { Injectable, Logger } from "@nestjs/common";
import {
  AssetFundamentals,
  CatalogEntry,
  ChartRangeOptions,
  daysBetweenIsoDates,
  HistoricalPricePoint,
  QuoteDetail,
  QuoteResult,
  StockQuoteProvider,
} from "../../domain/market-data.provider";

interface BrapiListEntry {
  stock?: string;
  name?: string;
  type?: string;
  sector?: string;
  logo?: string;
}

interface BrapiHistoricalPoint {
  date: number; // unix seconds
  close?: number;
  adjustedClose?: number;
}

/** B3 appends "F" to a ticker to mark the fractional-lot market segment (e.g. BBSE3F trades the
 *  same underlying stock as BBSE3, just in odd lots, at its own price — usually close to but not
 *  identical to the round-lot price). BRAPI's quote endpoint only prices the round-lot ticker, so
 *  a fractional ticker is priced via its base ticker as a best-effort fallback, always flagged
 *  `approximate: true` rather than presented as an exact fractional-market quote. */
const FRACTIONAL_TICKER_PATTERN = /^([A-Z]{4}\d{1,2})F$/;

function baseTickerFor(ticker: string): string | null {
  return ticker.toUpperCase().match(FRACTIONAL_TICKER_PATTERN)?.[1] ?? null;
}

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

interface BrapiQuoteResult {
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  currency?: string;
  shortName?: string;
  longName?: string;
  marketCap?: number;
  priceEarnings?: number;
  earningsPerShare?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  dividendYield?: number;
  logourl?: string;
  historicalDataPrice?: BrapiHistoricalPoint[];
}

/** brapi.dev — free-tier quote provider for B3 stocks/FIIs. Priority provider per spec. */
@Injectable()
export class BrapiProvider extends StockQuoteProvider {
  private readonly logger = new Logger(BrapiProvider.name);

  async fetchQuote(ticker: string): Promise<QuoteResult> {
    const { quote, approximate } = await this.fetchWithFractionalFallback(ticker);
    return { price: quote.regularMarketPrice as number, currency: quote.currency ?? "BRL", approximate };
  }

  async fetchDetail(ticker: string): Promise<QuoteDetail> {
    const { quote, approximate } = await this.fetchWithFractionalFallback(ticker, { range: "3mo", interval: "1d", fundamental: "true" });

    const history: HistoricalPricePoint[] = (quote.historicalDataPrice ?? [])
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
    add("P/L", quote.priceEarnings ?? null);
    add("LPA", quote.earningsPerShare ?? null);
    add("Dividend Yield", quote.dividendYield ?? null);

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
    const { quote } = await this.fetchWithFractionalFallback(ticker, { range, interval });

    let history: HistoricalPricePoint[] = (quote.historicalDataPrice ?? [])
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

  async listCatalog(): Promise<CatalogEntry[]> {
    const token = process.env.BRAPI_TOKEN;
    const url = `https://brapi.dev/api/quote/list${token ? `?token=${token}` : ""}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`BRAPI list request failed: ${res.status}`);

    const body = (await res.json()) as { stocks?: BrapiListEntry[] };
    return (body.stocks ?? [])
      .filter((s): s is BrapiListEntry & { stock: string } => typeof s.stock === "string")
      .map((s) => ({ ticker: s.stock, name: s.name ?? s.stock, type: s.type, logoUrl: s.logo }));
  }

  /** Tries the exact ticker first (so a fractional-lot code gets its own price whenever BRAPI
   *  actually has one) and only falls back to the round-lot ticker if that specific code has no
   *  quote — never silently prefers the fallback just because it's more likely to succeed. */
  private async fetchWithFractionalFallback(
    ticker: string,
    extraParams: Record<string, string> = {},
  ): Promise<{ quote: BrapiQuoteResult; approximate: boolean }> {
    try {
      const quote = await this.fetchRaw(ticker, extraParams);
      if (typeof quote.regularMarketPrice === "number") return { quote, approximate: false };
      throw new Error(`BRAPI returned no price for ${ticker}`);
    } catch (err) {
      const base = baseTickerFor(ticker);
      if (!base) throw err;
      this.logger.warn(`No direct quote for fractional ticker ${ticker}, falling back to ${base}: ${(err as Error).message}`);
      const quote = await this.fetchRaw(base, extraParams);
      if (typeof quote.regularMarketPrice !== "number") throw new Error(`BRAPI returned no quote for ${ticker} or ${base}`);
      return { quote, approximate: true };
    }
  }

  private async fetchRaw(ticker: string, extraParams: Record<string, string> = {}): Promise<BrapiQuoteResult> {
    const token = process.env.BRAPI_TOKEN;
    const params = new URLSearchParams(extraParams);
    if (token) params.set("token", token);
    const query = params.toString();
    const url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}${query ? `?${query}` : ""}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      throw new Error(`BRAPI request failed for ${ticker}: ${res.status}`);
    }
    const body = (await res.json()) as { results?: BrapiQuoteResult[] };
    const quote = body.results?.[0];
    if (!quote) throw new Error(`BRAPI returned no quote for ${ticker}`);
    return quote;
  }
}
