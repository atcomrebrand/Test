import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { QuotesService } from "./quotes.service";

@UseGuards(JwtAuthGuard)
@Controller("quotes")
export class QuotesController {
  constructor(private readonly service: QuotesService) {}

  @Get("ticker")
  ticker(@CurrentUser() user: AuthUser) {
    return this.service.ticker(user.userId);
  }
}
