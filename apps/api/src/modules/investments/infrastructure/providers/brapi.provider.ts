import { Injectable, Logger } from "@nestjs/common";
import { QuoteResult, StockQuoteProvider } from "../../domain/market-data.provider";

/** brapi.dev — free-tier quote provider for B3 stocks/FIIs. Priority provider per spec. */
@Injectable()
export class BrapiProvider extends StockQuoteProvider {
  private readonly logger = new Logger(BrapiProvider.name);

  async fetchQuote(ticker: string): Promise<QuoteResult> {
    const token = process.env.BRAPI_TOKEN;
    const url = `https://brapi.dev/api/quote/${encodeURIComponent(ticker)}${token ? `?token=${token}` : ""}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      throw new Error(`BRAPI request failed for ${ticker}: ${res.status}`);
    }
    const body = (await res.json()) as { results?: { regularMarketPrice?: number; currency?: string }[] };
    const quote = body.results?.[0];
    if (!quote || typeof quote.regularMarketPrice !== "number") {
      throw new Error(`BRAPI returned no quote for ${ticker}`);
    }

    return { price: quote.regularMarketPrice, currency: quote.currency ?? "BRL" };
  }
}
