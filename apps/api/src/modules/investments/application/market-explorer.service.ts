import { Injectable } from "@nestjs/common";
import { AssetRepository } from "../domain/asset.repository";
import { ChartRangeOptions } from "../domain/market-data.provider";
import { MarketPriceService } from "../infrastructure/market-price.service";
import { AssetAnalysisService } from "./asset-analysis.service";

/**
 * Browsing/researching an asset (price, chart, fundamentals) is decoupled from owning it — you
 * shouldn't have to "cadastrar" something just to look it up. This is also the natural surface a
 * future investment-rules/recommendations feature would sit on top of, since it already covers
 * every ticker in the catalog, not just the ones a user has added to their portfolio.
 */
@Injectable()
export class MarketExplorerService {
  constructor(
    private readonly marketPrice: MarketPriceService,
    private readonly assets: AssetRepository,
    private readonly analysis: AssetAnalysisService,
  ) {}

  async getQuoteDetail(userId: string, assetClass: "STOCK" | "FII" | "CRYPTO", ticker: string, forceRefresh = false) {
    const normalizedTicker = assetClass === "CRYPTO" ? ticker : ticker.toUpperCase();

    const [detail, owned] = await Promise.all([
      this.marketPrice.getDetail(assetClass, normalizedTicker, { forceRefresh }),
      this.assets.findByUserAndTicker(userId, assetClass, normalizedTicker),
    ]);

    return {
      ticker: normalizedTicker,
      class: assetClass,
      detail,
      ownedAssetId: owned?.id ?? null,
    };
  }

  /** Price history for the chart's time-range selector, for any catalog ticker regardless of
   *  ownership — same "research without cadastrar" principle as getQuoteDetail. */
  async getHistory(assetClass: "STOCK" | "FII" | "CRYPTO", ticker: string, options: ChartRangeOptions) {
    const normalizedTicker = assetClass === "CRYPTO" ? ticker : ticker.toUpperCase();
    return this.marketPrice.getHistory(assetClass, normalizedTicker, options);
  }

  /** Same Indicadores/Checklist/Proventos analysis as AssetsService.getAnalysis, for any catalog
   *  ticker regardless of ownership. Stocks/FIIs only. */
  async getAnalysis(assetClass: "STOCK" | "FII" | "CRYPTO", ticker: string) {
    if (assetClass !== "STOCK" && assetClass !== "FII") return null;
    return this.analysis.analyze(assetClass, ticker.toUpperCase());
  }
}
