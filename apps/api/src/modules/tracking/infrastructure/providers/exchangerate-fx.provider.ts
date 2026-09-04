import { Injectable } from "@nestjs/common";
import { FxQuote, TrackingFxRateProvider } from "../../domain/tracking-fx.provider";

/** Fallback for when AwesomeAPI is unreachable (free-tier APIs like this one are prone to
 *  blocking requests from cloud/datacenter IP ranges). International, no API key, generous free
 *  tier. Response shape: { result: "success", rates: { BRL: 5.4321, ... } } — a flat daily snapshot,
 *  no previous-close reference exposed. */
const URL = "https://open.er-api.com/v6/latest/USD";

@Injectable()
export class ExchangerateFxProvider extends TrackingFxRateProvider {
  async fetchUsdToBrl(): Promise<FxQuote> {
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`open.er-api.com USD request failed: ${res.status}`);

    const body = (await res.json()) as { result?: string; rates?: { BRL?: number } };
    const rate = body.rates?.BRL;
    if (body.result !== "success" || !rate || Number.isNaN(rate) || rate <= 0) {
      throw new Error("open.er-api.com retornou uma cotação inválida.");
    }
    return { rate, previousClose: null };
  }
}
