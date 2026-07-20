import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CatalogCacheService } from "../infrastructure/catalog-cache.service";

/** Powers the "browse instead of type blind" asset picker — search real B3 tickers/FIIs or top
 *  crypto coins by market cap, so the user doesn't have to already know the exact ticker. */
@UseGuards(JwtAuthGuard)
@Controller("investments/catalog")
export class CatalogController {
  constructor(private readonly catalog: CatalogCacheService) {}

  @Get()
  search(@Query("class") assetClass: "STOCK" | "FII" | "CRYPTO", @Query("query") query = "") {
    return this.catalog.search(assetClass ?? "STOCK", query);
  }
}
