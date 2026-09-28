import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { AuthUser, CurrentUser } from "../../../common/decorators/current-user.decorator";
import { ProfitService } from "../application/profit.service";
import {
  ChannelDto,
  FixedCostDto,
  ProductChannelPriceDto,
  ProductDto,
  SettingsDto,
  SimulateDto,
} from "../application/dto/profit.dto";

@UseGuards(JwtAuthGuard)
@Controller("profit")
export class ProfitController {
  constructor(private readonly service: ProfitService) {}

  @Get("settings")
  settings(@CurrentUser() user: AuthUser) {
    return this.service.settings(user.userId);
  }

  @Patch("settings")
  updateSettings(@CurrentUser() user: AuthUser, @Body() dto: SettingsDto) {
    return this.service.updateSettings(user.userId, dto);
  }

  @Get("fixed-costs")
  fixedCosts(@CurrentUser() user: AuthUser) {
    return this.service.listFixedCosts(user.userId);
  }

  @Post("fixed-costs")
  createFixedCost(@CurrentUser() user: AuthUser, @Body() dto: FixedCostDto) {
    return this.service.createFixedCost(user.userId, dto);
  }

  @Patch("fixed-costs/:id")
  updateFixedCost(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: FixedCostDto) {
    return this.service.updateFixedCost(user.userId, id, dto);
  }

  @Delete("fixed-costs/:id")
  removeFixedCost(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.removeFixedCost(user.userId, id);
  }

  @Get("channels")
  channels(@CurrentUser() user: AuthUser) {
    return this.service.listChannels(user.userId);
  }

  @Post("channels")
  createChannel(@CurrentUser() user: AuthUser, @Body() dto: ChannelDto) {
    return this.service.createChannel(user.userId, dto);
  }

  @Patch("channels/:id")
  updateChannel(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: ChannelDto) {
    return this.service.updateChannel(user.userId, id, dto);
  }

  @Delete("channels/:id")
  archiveChannel(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.archiveChannel(user.userId, id);
  }

  @Get("products")
  products(@CurrentUser() user: AuthUser) {
    return this.service.listProducts(user.userId);
  }

  @Post("products")
  createProduct(@CurrentUser() user: AuthUser, @Body() dto: ProductDto) {
    return this.service.createProduct(user.userId, dto);
  }

  /** A meta de lucro entra por query porque ela é uma pergunta sobre a tela, não um dado do
   *  produto: "quantas vendas pra eu tirar X esse mês" muda a cada vez que se pergunta. */
  @Get("products/:id")
  product(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("targetProfit") targetProfit?: string) {
    return this.service.getProduct(user.userId, id, Math.max(0, Number(targetProfit) || 0));
  }

  @Patch("products/:id")
  updateProduct(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: ProductDto) {
    return this.service.updateProduct(user.userId, id, dto);
  }

  @Delete("products/:id")
  archiveProduct(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.archiveProduct(user.userId, id);
  }

  @Post("products/:id/price")
  setPrice(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: ProductChannelPriceDto) {
    return this.service.setProductPrice(user.userId, id, dto);
  }

  @Post("simulate")
  simulate(@CurrentUser() user: AuthUser, @Body() dto: SimulateDto) {
    return this.service.simulate(user.userId, dto);
  }
}
