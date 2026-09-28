import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { TrackingDashboardService } from "../application/tracking-dashboard.service";

@UseGuards(JwtAuthGuard)
@Controller("tracking/dashboard")
export class TrackingDashboardController {
  constructor(private readonly service: TrackingDashboardService) {}

  @Get()
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user.userId);
  }
}
