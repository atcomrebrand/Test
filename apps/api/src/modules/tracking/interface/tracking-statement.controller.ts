import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { TrackingStatementService } from "../application/tracking-statement.service";
import { StatementQueryDto } from "../application/dto/tracking-session.dto";

@UseGuards(JwtAuthGuard)
@Controller("tracking/statement")
export class TrackingStatementController {
  constructor(private readonly service: TrackingStatementService) {}

  @Get()
  generate(@CurrentUser() user: AuthUser, @Query() query: StatementQueryDto) {
    // As datas seguem como texto de calendário até o service: convertê-las aqui num `Date` é
    // exatamente onde o fuso as deslocava um dia.
    return this.service.generate(user.userId, {
      jobId: query.jobId,
      from: query.from,
      to: query.to,
      lang: query.lang ?? "PT",
      audience: query.audience ?? "PERSONAL",
    });
  }
}
