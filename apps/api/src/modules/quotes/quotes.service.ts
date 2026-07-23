import { Injectable } from "@nestjs/common";
import { TrackingFxService } from "../tracking/application/tracking-fx.service";

export interface QuoteTickerItem {
  symbol: string;
  label: string;
  flag: string;
  rate: number | null;
  /** Previous trading day's close, when the source that answered this request exposes one — null
   *  hides the rising/falling indicator on the frontend rather than showing a misleading arrow. */
  previousClose: number | null;
}

/** Cotações pro ticker rolante da Home — hoje só USD/BRL, reaproveitando o mesmo cache+fallback
 *  já usado pelos trabalhos em dólar do Horas (TrackingFxService), pra não ter duas fontes/caches
 *  brigando pelo mesmo número. Novas moedas entram aqui como um item a mais no array. */
@Injectable()
export class QuotesService {
  constructor(private readonly fx: TrackingFxService) {}

  async ticker(): Promise<QuoteTickerItem[]> {
    const quote = await this.fx.getUsdToBrlQuote();
    return [{ symbol: "USD", label: "USD", flag: "🇺🇸", rate: quote?.rate ?? null, previousClose: quote?.previousClose ?? null }];
  }
}
