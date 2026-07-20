import { Injectable } from "@nestjs/common";
import { AssetFundamentals, HistoricalPricePoint, QuoteDetail, QuoteResult, CryptoQuoteProvider } from "../../domain/market-data.provider";

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

interface CoinGeckoMarketData {
  current_price?: Record<string, number>;
  price_change_percentage_24h?: number;
  market_cap?: Record<string, number>;
  high_24h?: Record<string, number>;
  low_24h?: Record<string, number>;
  ath?: Record<string, number>;
  atl?: Record<string, number>;
  circulating_supply?: number;
  total_supply?: number;
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

  async fetchDetail(ticker: string): Promise<QuoteDetail> {
    const coinId = normalizeCoinId(ticker);

    const [coinRes, chartRes] = await Promise.all([
      fetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}?localization=false&tickers=false&community_data=false&developer_data=false`, {
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=brl&days=90&interval=daily`, {
        signal: AbortSignal.timeout(8000),
      }),
    ]);

    if (!coinRes.ok) throw new Error(`CoinGecko request failed for ${coinId}: ${coinRes.status}`);

    const coinBody = (await coinRes.json()) as { market_data?: CoinGeckoMarketData };
    const market = coinBody.market_data;
    const price = market?.current_price?.brl;
    if (typeof price !== "number") throw new Error(`CoinGecko returned no quote for ${coinId}`);

    let history: HistoricalPricePoint[] = [];
    if (chartRes.ok) {
      const chartBody = (await chartRes.json()) as { prices?: [number, number][] };
      history = (chartBody.prices ?? []).map(([ts, close]) => ({ date: new Date(ts).toISOString().slice(0, 10), close }));
    }

    const fundamentals: AssetFundamentals = {};
    const add = (label: string, value: number | null | undefined) => {
      if (value !== undefined && value !== null) fundamentals[label] = value;
    };
    add("Valor de mercado", market?.market_cap?.brl ?? null);
    add("Máxima 24h", market?.high_24h?.brl ?? null);
    add("Mínima 24h", market?.low_24h?.brl ?? null);
    add("Máxima histórica", market?.ath?.brl ?? null);
    add("Mínima histórica", market?.atl?.brl ?? null);
    add("Oferta circulante", market?.circulating_supply ?? null);
    add("Oferta total", market?.total_supply ?? null);

    return {
      price,
      currency: "BRL",
      changePercent: market?.price_change_percentage_24h ?? null,
      history,
      fundamentals,
    };
  }
}
