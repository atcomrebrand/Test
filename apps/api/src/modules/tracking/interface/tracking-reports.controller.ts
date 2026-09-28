import { BadRequestException, Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { TrackingReportsService } from "../application/tracking-reports.service";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

@UseGuards(JwtAuthGuard)
@Controller("tracking/reports")
export class TrackingReportsController {
  constructor(private readonly service: TrackingReportsService) {}

  @Get()
  generate(
    @CurrentUser() user: AuthUser,
    @Query("period") period: string = "mes",
    @Query("from") fromParam?: string,
    @Query("to") toParam?: string,
  ) {
    const now = new Date();
    let from: Date;
    let to: Date;

    switch (period) {
      case "hoje":
        from = startOfDay(now);
        to = new Date(from.getTime() + 86_400_000);
        break;
      case "semana":
        from = startOfWeek(now);
        to = new Date(from.getTime() + 7 * 86_400_000);
        break;
      case "ano":
        from = new Date(now.getFullYear(), 0, 1);
        to = new Date(now.getFullYear() + 1, 0, 1);
        break;
      case "personalizado":
        if (!fromParam || !toParam) throw new BadRequestException("Informe 'from' e 'to' para período personalizado.");
        from = new Date(fromParam);
        to = new Date(new Date(toParam).getTime() + 86_400_000);
        break;
      case "mes":
      default:
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }

    return this.service.generate(user.userId, from, to);
  }
}
