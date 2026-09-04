import { Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { InvestmentsResetService } from "../application/investments-reset.service";

@UseGuards(JwtAuthGuard)
@Controller("investments")
export class InvestmentsResetController {
  constructor(private readonly service: InvestmentsResetService) {}

  @Post("reset")
  reset(@CurrentUser() user: AuthUser) {
    return this.service.reset(user.userId);
  }
}
