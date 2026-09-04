import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { TrackingStatsService } from "../application/tracking-stats.service";

@UseGuards(JwtAuthGuard)
@Controller("tracking/stats")
export class TrackingStatsController {
  constructor(private readonly service: TrackingStatsService) {}

  @Get()
  summary(@CurrentUser() user: AuthUser) {
    return this.service.summary(user.userId);
  }
}
