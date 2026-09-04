import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { CatalogCacheService } from "../infrastructure/catalog-cache.service";
import { MarketExplorerService } from "../application/market-explorer.service";
import { parseChartRangeOptions } from "../domain/market-data.provider";

/** Powers the "browse instead of type blind" asset picker and the "Explorar" market discovery
 *  page — search real B3 tickers/FIIs or top crypto coins, and look up price/chart/fundamentals
 *  for any of them without first having to add them to a portfolio. */
@UseGuards(JwtAuthGuard)
@Controller("investments/catalog")
export class CatalogController {
  constructor(
    private readonly catalog: CatalogCacheService,
    private readonly explorer: MarketExplorerService,
  ) {}

  @Get()
  search(@Query("class") assetClass: "STOCK" | "FII" | "CRYPTO", @Query("query") query = "") {
    return this.catalog.search(assetClass ?? "STOCK", query);
  }

  @Get("quote-detail")
  quoteDetail(
    @CurrentUser() user: AuthUser,
    @Query("class") assetClass: "STOCK" | "FII" | "CRYPTO",
    @Query("ticker") ticker: string,
    @Query("refresh") refresh?: string,
  ) {
    return this.explorer.getQuoteDetail(user.userId, assetClass ?? "STOCK", ticker, refresh === "true");
  }

  @Get("history")
  history(
    @Query("class") assetClass: "STOCK" | "FII" | "CRYPTO",
    @Query("ticker") ticker: string,
    @Query("range") range?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.explorer.getHistory(assetClass ?? "STOCK", ticker, parseChartRangeOptions(range, from, to));
  }

  @Get("analysis")
  analysis(@Query("class") assetClass: "STOCK" | "FII" | "CRYPTO", @Query("ticker") ticker: string) {
    return this.explorer.getAnalysis(assetClass ?? "STOCK", ticker);
  }
}
