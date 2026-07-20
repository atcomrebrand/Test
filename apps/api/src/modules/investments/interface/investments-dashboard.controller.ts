import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { InvestmentsDashboardService } from "../application/investments-dashboard.service";

@UseGuards(JwtAuthGuard)
@Controller("investments/dashboard")
export class InvestmentsDashboardController {
  constructor(private readonly service: InvestmentsDashboardService) {}

  @Get("summary")
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user.userId);
  }
}
