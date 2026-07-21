import { Controller, Get, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { TrackingExportService } from "../application/tracking-export.service";

@UseGuards(JwtAuthGuard)
@Controller("tracking/export")
export class TrackingExportController {
  constructor(private readonly service: TrackingExportService) {}

  @Get("sessions.csv")
  async sessionsCsv(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const csv = await this.service.sessionsCsv(user.userId);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="sessoes.csv"');
    res.send(csv);
  }
}
