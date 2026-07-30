import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { HomeDashboardService } from "../application/home-dashboard.service";

@UseGuards(JwtAuthGuard)
@Controller("home")
export class HomeDashboardController {
  constructor(private readonly service: HomeDashboardService) {}

  @Get("dashboard")
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user.userId);
  }
}
