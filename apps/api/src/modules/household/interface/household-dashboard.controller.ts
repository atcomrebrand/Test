import { Controller, Get, Param, ParseIntPipe, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { HouseholdDashboardService } from "../application/household-dashboard.service";

@UseGuards(JwtAuthGuard)
@Controller("household/dashboard")
export class HouseholdDashboardController {
  constructor(private readonly service: HouseholdDashboardService) {}

  @Get(":year/:month")
  month(@CurrentUser() user: AuthUser, @Param("year", ParseIntPipe) year: number, @Param("month", ParseIntPipe) month: number) {
    return this.service.month(user.userId, year, month);
  }
}
