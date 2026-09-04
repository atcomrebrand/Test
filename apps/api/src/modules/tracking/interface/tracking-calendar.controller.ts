import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { TrackingCalendarService } from "../application/tracking-calendar.service";

@UseGuards(JwtAuthGuard)
@Controller("tracking/calendar")
export class TrackingCalendarController {
  constructor(private readonly service: TrackingCalendarService) {}

  @Get()
  month(@CurrentUser() user: AuthUser, @Query("year") year: string, @Query("month") month: string) {
    const now = new Date();
    const y = year ? Number(year) : now.getFullYear();
    const m = month ? Number(month) : now.getMonth() + 1;
    return this.service.month(user.userId, y, m);
  }
}
