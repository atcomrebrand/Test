import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { AuthUser, CurrentUser } from "../../../common/decorators/current-user.decorator";
import {
  CreateCrmResellerDto,
  CreateMovementDto,
  CreateRechargeDto,
  CrmResellersService,
  UpdateApproxClientsDto,
  UpdateCrmResellerDto,
  UpsertResellerLinkDto,
} from "../application/crm-resellers.service";

@UseGuards(JwtAuthGuard)
@Controller("crm/resellers")
export class CrmResellersController {
  constructor(private readonly service: CrmResellersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query("portfolioId") portfolioId?: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
    @Query("onlyLowCredit") onlyLowCredit?: string,
  ) {
    return this.service.list(user.userId, {
      portfolioId,
      status,
      search,
      onlyLowCredit: onlyLowCredit === "true",
    });
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCrmResellerDto) {
    return this.service.create(user.userId, dto);
  }

  @Get(":id")
  detail(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.detail(user.userId, id);
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateCrmResellerDto) {
    return this.service.update(user.userId, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.remove(user.userId, id);
  }

  /** Cria/atualiza o vínculo com um serviço — créditos e estimativa são por serviço. */
  @Post(":id/portfolios")
  upsertLink(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpsertResellerLinkDto) {
    return this.service.upsertLink(user.userId, id, dto);
  }

  @Post("links/:linkId/recharges")
  recharge(@CurrentUser() user: AuthUser, @Param("linkId") linkId: string, @Body() dto: CreateRechargeDto) {
    return this.service.recharge(user.userId, linkId, dto);
  }

  @Post("links/:linkId/movements")
  addMovement(@CurrentUser() user: AuthUser, @Param("linkId") linkId: string, @Body() dto: CreateMovementDto) {
    return this.service.addMovement(user.userId, linkId, dto);
  }

  @Get("links/:linkId/statement")
  statement(@CurrentUser() user: AuthUser, @Param("linkId") linkId: string) {
    return this.service.statement(user.userId, linkId);
  }

  @Patch("links/:linkId/approx-clients")
  updateApprox(
    @CurrentUser() user: AuthUser,
    @Param("linkId") linkId: string,
    @Body() dto: UpdateApproxClientsDto,
  ) {
    return this.service.updateApproxClients(user.userId, linkId, dto);
  }

  @Get("links/:linkId/price-history")
  priceHistory(@CurrentUser() user: AuthUser, @Param("linkId") linkId: string) {
    return this.service.priceHistory(user.userId, linkId);
  }

  @Get("links/:linkId/approx-history")
  approxHistory(@CurrentUser() user: AuthUser, @Param("linkId") linkId: string) {
    return this.service.approxHistory(user.userId, linkId);
  }
}
