import { Injectable } from "@nestjs/common";
import { QuoteResult, CryptoQuoteProvider } from "../../domain/market-data.provider";

/** CoinGecko public API — symbol must be a CoinGecko coin id (e.g. "bitcoin", "ethereum"). */
@Injectable()
export class CoinGeckoProvider extends CryptoQuoteProvider {
  async fetchQuote(coinId: string): Promise<QuoteResult> {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coinId)}&vs_currencies=brl`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      throw new Error(`CoinGecko request failed for ${coinId}: ${res.status}`);
    }
    const body = (await res.json()) as Record<string, { brl?: number }>;
    const price = body[coinId]?.brl;
    if (typeof price !== "number") {
      throw new Error(`CoinGecko returned no quote for ${coinId}`);
    }

    return { price, currency: "BRL" };
  }
}
