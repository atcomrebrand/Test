import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { DividendsService } from "../application/dividends.service";

@UseGuards(JwtAuthGuard)
@Controller("investments/dividends")
export class DividendsController {
  constructor(private readonly dividends: DividendsService) {}

  @Get("market")
  market() {
    return this.dividends.getMarketCalendar();
  }

  @Get("portfolio")
  portfolio(@CurrentUser() user: AuthUser) {
    return this.dividends.getPortfolioCalendar(user.userId);
  }
}
