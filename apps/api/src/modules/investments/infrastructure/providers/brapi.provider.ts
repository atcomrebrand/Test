import { Injectable, Logger } from "@nestjs/common";
import { AssetFundamentals, CatalogEntry, HistoricalPricePoint, QuoteDetail, QuoteResult, StockQuoteProvider } from "../../domain/market-data.provider";

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
    const quote = await this.fetchRaw(ticker);
    if (typeof quote.regularMarketPrice !== "number") {
      throw new Error(`BRAPI returned no quote for ${ticker}`);
    }
    return { price: quote.regularMarketPrice, currency: quote.currency ?? "BRL" };
  }

  async fetchDetail(ticker: string): Promise<QuoteDetail> {
    const quote = await this.fetchRaw(ticker, { range: "3mo", interval: "1d", fundamental: "true" });
    if (typeof quote.regularMarketPrice !== "number") {
      throw new Error(`BRAPI returned no quote for ${ticker}`);
    }

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
      price: quote.regularMarketPrice,
      currency: quote.currency ?? "BRL",
      changePercent: quote.regularMarketChangePercent ?? null,
      history,
      fundamentals,
    };
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
