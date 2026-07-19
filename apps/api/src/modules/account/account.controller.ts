import { Body, Controller, Delete, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { AccountService } from "./account.service";
import { DeleteAccountDto, ResetAccountDataDto } from "./dto/account.dto";

@UseGuards(JwtAuthGuard)
@Controller("account")
export class AccountController {
  constructor(private readonly service: AccountService) {}

  @Post("reset-data")
  resetData(@CurrentUser() user: AuthUser, @Body() _dto: ResetAccountDataDto) {
    return this.service.resetData(user.userId);
  }

  @Delete()
  deleteAccount(@CurrentUser() user: AuthUser, @Body() dto: DeleteAccountDto) {
    return this.service.deleteAccount(user.userId, dto.password);
  }
}
