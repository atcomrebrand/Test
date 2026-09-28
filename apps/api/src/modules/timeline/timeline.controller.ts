import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { TimelineService } from "./timeline.service";

@UseGuards(JwtAuthGuard)
@Controller("timeline")
export class TimelineController {
  constructor(private readonly service: TimelineService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.service.list(user.userId);
  }
}
