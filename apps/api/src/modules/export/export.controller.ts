import { Controller, Get, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { ExportService } from "./export.service";

@UseGuards(JwtAuthGuard)
@Controller("export")
export class ExportController {
  constructor(private readonly service: ExportService) {}

  @Get("installments.csv")
  async installmentsCsv(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const csv = await this.service.installmentsCsv(user.userId);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="parcelas.csv"');
    res.send(csv);
  }
}
