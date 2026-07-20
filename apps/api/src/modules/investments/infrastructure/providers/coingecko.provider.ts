import { Injectable } from "@nestjs/common";
import { QuoteResult, CryptoQuoteProvider } from "../../domain/market-data.provider";

/** Convenience map so users can type a familiar ticker (BTC) instead of memorizing CoinGecko's
 *  coin id (bitcoin). Anything not listed here is assumed to already be a valid CoinGecko id. */
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: "bitcoin", ETH: "ethereum", USDT: "tether", USDC: "usd-coin", BNB: "binancecoin",
  SOL: "solana", XRP: "ripple", ADA: "cardano", DOGE: "dogecoin", TRX: "tron",
  DOT: "polkadot", MATIC: "matic-network", POL: "polygon-ecosystem-token", LTC: "litecoin",
  SHIB: "shiba-inu", AVAX: "avalanche-2", LINK: "chainlink", ATOM: "cosmos",
  UNI: "uniswap", XLM: "stellar", BCH: "bitcoin-cash", NEAR: "near",
};

export function normalizeCoinId(ticker: string): string {
  return SYMBOL_TO_COINGECKO_ID[ticker.toUpperCase()] ?? ticker.toLowerCase();
}

/** CoinGecko public API — accepts either a common ticker (BTC) or a raw CoinGecko coin id. */
@Injectable()
export class CoinGeckoProvider extends CryptoQuoteProvider {
  async fetchQuote(ticker: string): Promise<QuoteResult> {
    const coinId = normalizeCoinId(ticker);
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
