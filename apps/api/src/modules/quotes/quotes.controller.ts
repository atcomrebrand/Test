import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { QuotesService } from "./quotes.service";

@UseGuards(JwtAuthGuard)
@Controller("quotes")
export class QuotesController {
  constructor(private readonly service: QuotesService) {}

  @Get("ticker")
  ticker() {
    return this.service.ticker();
  }
}
