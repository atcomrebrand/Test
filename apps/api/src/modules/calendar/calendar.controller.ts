import { Controller, Get, Param, ParseIntPipe, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { CalendarService } from "./calendar.service";

@UseGuards(JwtAuthGuard)
@Controller("calendar")
export class CalendarController {
  constructor(private readonly service: CalendarService) {}

  @Get(":year")
  year(@CurrentUser() user: AuthUser, @Param("year", ParseIntPipe) year: number) {
    return this.service.year(user.userId, year);
  }

  @Get(":year/:month")
  month(
    @CurrentUser() user: AuthUser,
    @Param("year", ParseIntPipe) year: number,
    @Param("month", ParseIntPipe) month: number,
  ) {
    return this.service.month(user.userId, year, month);
  }
}
