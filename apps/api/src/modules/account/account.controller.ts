import { Body, Controller, Delete, Patch, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { AccountService } from "./account.service";
import { ChangeEmailDto, ChangePasswordDto, DeleteAccountDto, ResetAccountDataDto, UpdateProfileDto } from "./dto/account.dto";

@UseGuards(JwtAuthGuard)
@Controller("account")
export class AccountController {
  constructor(private readonly service: AccountService) {}

  @Patch("profile")
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.service.updateProfile(user.userId, dto);
  }

  /** Limitado igual ao registro: as duas rotas abaixo checam senha, e sem limite viram um oráculo
   *  pra adivinhar a senha de quem deixou a sessão aberta. */
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Patch("email")
  changeEmail(@CurrentUser() user: AuthUser, @Body() dto: ChangeEmailDto) {
    return this.service.changeEmail(user.userId, dto.email, dto.password);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Patch("password")
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.service.changePassword(user.userId, dto.currentPassword, dto.newPassword);
  }

  @Post("reset-data")
  resetData(@CurrentUser() user: AuthUser, @Body() _dto: ResetAccountDataDto) {
    return this.service.resetData(user.userId);
  }

  @Delete()
  deleteAccount(@CurrentUser() user: AuthUser, @Body() dto: DeleteAccountDto) {
    return this.service.deleteAccount(user.userId, dto.password);
  }
}
