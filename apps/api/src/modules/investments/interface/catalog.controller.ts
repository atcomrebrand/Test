import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { CatalogCacheService } from "../infrastructure/catalog-cache.service";
import { MarketExplorerService } from "../application/market-explorer.service";

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
}
