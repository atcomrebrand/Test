import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { FinancingsService } from "../application/financings.service";
import {
  CreateFinancingDto,
  PayFinancingInstallmentDto,
  UpdateAssetValueDto,
  UpdateFinancingDto,
  UpdateFinancingInstallmentStatusDto,
  UpdatePayoffDto,
} from "../application/dto/financing.dto";

@UseGuards(JwtAuthGuard)
@Controller("financings")
export class FinancingsController {
  constructor(private readonly service: FinancingsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.userId);
  }

  @Get("summary")
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user.userId);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.findOne(user.userId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFinancingDto) {
    return this.service.create(user.userId, dto);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateFinancingDto) {
    return this.service.update(user.userId, id, dto);
  }

  @Patch(":id/payoff")
  updatePayoff(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdatePayoffDto) {
    return this.service.updatePayoff(user.userId, id, dto);
  }

  @Get(":id/payoff-quotes")
  payoffQuoteHistory(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.payoffQuoteHistory(user.userId, id);
  }

  @Patch(":id/asset-value")
  updateAssetValue(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateAssetValueDto) {
    return this.service.updateAssetValue(user.userId, id, dto);
  }

  @Get(":id/asset-values")
  assetValueHistory(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.assetValueHistory(user.userId, id);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.remove(user.userId, id);
  }

  @Post("installments/:id/pay")
  payInstallment(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: PayFinancingInstallmentDto) {
    return this.service.payInstallment(user.userId, id, dto);
  }

  @Post("installments/:id/unpay")
  unpayInstallment(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.unpayInstallment(user.userId, id);
  }

  @Patch("installments/:id/status")
  updateInstallmentStatus(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateFinancingInstallmentStatusDto,
  ) {
    return this.service.updateInstallmentStatus(user.userId, id, dto);
  }
}
