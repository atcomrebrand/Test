import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { DashboardService } from "./dashboard.service";

@UseGuards(JwtAuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get("summary")
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user.userId);
  }

  @Get("spending-evolution")
  spendingEvolution(@CurrentUser() user: AuthUser) {
    return this.service.spendingEvolution(user.userId);
  }

  @Get("by-category")
  byCategory(@CurrentUser() user: AuthUser) {
    return this.service.byCategory(user.userId);
  }
}
