import { Injectable } from "@nestjs/common";
import { FxQuote, TrackingFxRateProvider } from "../../domain/tracking-fx.provider";

/** Free, no API key, Brazilian-hosted — the same kind of no-signup public API BRAPI/CoinGecko
 *  already are for the rest of this codebase. Response shape:
 *  { "USDBRL": { "bid": "5.4321", "varBid": "-0.0339", ... } } — varBid is bid minus the previous
 *  close, so subtracting it back out gives the previous close directly, no extra request needed. */
const URL = "https://economia.awesomeapi.com.br/json/last/USD-BRL";

@Injectable()
export class AwesomeApiFxProvider extends TrackingFxRateProvider {
  async fetchUsdToBrl(): Promise<FxQuote> {
    // Sem um User-Agent de navegador, alguns free-tier providers (inclusive esse) bloqueiam a
    // requisição com 403 por parecer tráfego de bot/datacenter.
    const res = await fetch(URL, { headers: { "User-Agent": "Mozilla/5.0 (compatible; FerramentasDoMauro/1.0)" } });
    if (!res.ok) throw new Error(`AwesomeAPI USD-BRL request failed: ${res.status}`);

    const body = (await res.json()) as { USDBRL?: { bid?: string; varBid?: string } };
    const rate = Number(body.USDBRL?.bid);
    if (!rate || Number.isNaN(rate) || rate <= 0) throw new Error("AwesomeAPI USD-BRL retornou uma cotação inválida.");

    const varBid = Number(body.USDBRL?.varBid);
    const previousClose = Number.isFinite(varBid) ? rate - varBid : null;
    return { rate, previousClose };
  }
}
