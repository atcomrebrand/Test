import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { AssetsService } from "../application/assets.service";
import { AddAssetIncomeDto, CreateAssetDto, CreateTransactionDto, UpdateAssetDto } from "../application/dto/asset.dto";
import { parseChartRangeOptions } from "../domain/market-data.provider";

@UseGuards(JwtAuthGuard)
@Controller("investments/assets")
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query("class") assetClass?: string, @Query("refresh") refresh?: string) {
    return this.service.findAll(user.userId, assetClass, refresh === "true");
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.findOne(user.userId, id);
  }

  @Get(":id/quote-detail")
  getQuoteDetail(@CurrentUser() user: AuthUser, @Param("id") id: string, @Query("refresh") refresh?: string) {
    return this.service.getQuoteDetail(user.userId, id, refresh === "true");
  }

  @Get(":id/history")
  getHistory(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Query("range") range?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.getHistory(user.userId, id, parseChartRangeOptions(range, from, to));
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAssetDto) {
    return this.service.create(user.userId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateAssetDto) {
    return this.service.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.remove(user.userId, id);
  }

  @Post(":id/transactions")
  addTransaction(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: CreateTransactionDto) {
    return this.service.addTransaction(user.userId, id, dto);
  }

  @Post(":id/income")
  addIncome(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: AddAssetIncomeDto) {
    return this.service.addIncome(user.userId, id, dto);
  }
}
