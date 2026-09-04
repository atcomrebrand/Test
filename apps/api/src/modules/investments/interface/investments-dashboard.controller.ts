import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { InvestmentsDashboardService } from "../application/investments-dashboard.service";

@UseGuards(JwtAuthGuard)
@Controller("investments/dashboard")
export class InvestmentsDashboardController {
  constructor(private readonly service: InvestmentsDashboardService) {}

  @Get("summary")
  summary(@CurrentUser() user: AuthUser, @Query("refresh") refresh?: string) {
    return this.service.summary(user.userId, refresh === "true");
  }

  @Get("history")
  history(@CurrentUser() user: AuthUser, @Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.service.history(user.userId, Number(page) || 1, Number(pageSize) || 20);
  }
}
