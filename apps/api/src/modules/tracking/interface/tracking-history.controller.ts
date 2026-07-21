import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { TrackingHistoryService } from "../application/tracking-history.service";

@UseGuards(JwtAuthGuard)
@Controller("tracking/history")
export class TrackingHistoryController {
  constructor(private readonly service: TrackingHistoryService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.service.list(user.userId, page ? Number(page) : 1, pageSize ? Number(pageSize) : undefined);
  }
}
