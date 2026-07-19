import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { StatisticsService } from "./statistics.service";

@UseGuards(JwtAuthGuard)
@Controller("statistics")
export class StatisticsController {
  constructor(private readonly service: StatisticsService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser) {
    return this.service.overview(user.userId);
  }
}
