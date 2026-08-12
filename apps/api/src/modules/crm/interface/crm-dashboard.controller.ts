import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { AuthUser, CurrentUser } from "../../../common/decorators/current-user.decorator";
import { CrmDashboardService, PeriodKey } from "../application/crm-dashboard.service";

@UseGuards(JwtAuthGuard)
@Controller("crm/dashboard")
export class CrmDashboardController {
  constructor(private readonly service: CrmDashboardService) {}

  /** Sem portfolioId = "Todos os portfólios" (§2). */
  @Get()
  overview(
    @CurrentUser() user: AuthUser,
    @Query("portfolioId") portfolioId?: string,
    @Query("period") period: PeriodKey = "month",
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.overview(user.userId, portfolioId, period, from, to);
  }

  @Get("financial")
  financial(
    @CurrentUser() user: AuthUser,
    @Query("portfolioId") portfolioId?: string,
    @Query("period") period: PeriodKey = "month",
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.service.financial(user.userId, portfolioId, period, from, to);
  }

  @Get("due-board")
  dueBoard(@CurrentUser() user: AuthUser, @Query("portfolioId") portfolioId?: string) {
    return this.service.dueBoard(user.userId, portfolioId);
  }

  @Get("resellers")
  resellers(@CurrentUser() user: AuthUser, @Query("portfolioId") portfolioId?: string) {
    return this.service.resellerIndicators(user.userId, portfolioId);
  }

  @Get("comparison")
  comparison(@CurrentUser() user: AuthUser) {
    return this.service.comparison(user.userId);
  }

  @Get("retention")
  retention(@CurrentUser() user: AuthUser, @Query("portfolioId") portfolioId?: string) {
    return this.service.retention(user.userId, portfolioId);
  }

  @Get("retention-queue")
  retentionQueue(@CurrentUser() user: AuthUser, @Query("portfolioId") portfolioId?: string) {
    return this.service.retentionQueue(user.userId, portfolioId);
  }

  @Get("churn")
  churn(@CurrentUser() user: AuthUser, @Query("portfolioId") portfolioId?: string) {
    return this.service.churn(user.userId, portfolioId);
  }

  @Get("alerts")
  alerts(@CurrentUser() user: AuthUser, @Query("portfolioId") portfolioId?: string) {
    return this.service.alerts(user.userId, portfolioId);
  }
}
