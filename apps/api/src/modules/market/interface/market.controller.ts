import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthUser, CurrentUser } from "../../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CommitNotaDto, ListPurchasesQueryDto, ScanNotaDto } from "../application/dto/market.dto";
import { MarketImportService } from "../application/market-import.service";
import { MarketService } from "../application/market.service";

@UseGuards(JwtAuthGuard)
@Controller("market")
export class MarketController {
  constructor(
    private readonly market: MarketService,
    private readonly importService: MarketImportService,
  ) {}

  /** Read-only: reaches out to SEFAZ-SP and returns what it found, persisting nothing. Rate-limited
   *  tighter than the app default because each call is an outbound request to a public government
   *  portal — a scan loop hammering it would be both rude and a good way to get blocked. */
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post("notas/scan")
  scan(@CurrentUser() user: AuthUser, @Body() dto: ScanNotaDto) {
    return this.importService.preview(user.userId, dto.code);
  }

  @Post("notas/commit")
  commit(@CurrentUser() user: AuthUser, @Body() dto: CommitNotaDto) {
    return this.importService.commit(user.userId, dto);
  }

  @Get("purchases")
  listPurchases(@CurrentUser() user: AuthUser, @Query() query: ListPurchasesQueryDto) {
    return this.market.listPurchases(user.userId, query.from, query.to);
  }

  @Get("purchases/:id")
  getPurchase(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.market.getPurchase(user.userId, id);
  }

  @Delete("purchases/:id")
  removePurchase(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.market.removePurchase(user.userId, id);
  }

  @Get("products")
  listProducts(@CurrentUser() user: AuthUser) {
    return this.market.listProducts(user.userId);
  }

  @Get("products/:id")
  getProduct(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.market.getProduct(user.userId, id);
  }
}
