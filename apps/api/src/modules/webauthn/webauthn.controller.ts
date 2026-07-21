import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { WebAuthnService } from "./webauthn.service";
import { LoginVerifyDto, RegistrationVerifyDto } from "./dto/webauthn.dto";

@Controller("webauthn")
export class WebAuthnController {
  constructor(private readonly webauthn: WebAuthnService) {}

  @UseGuards(JwtAuthGuard)
  @Get("registration-options")
  getRegistrationOptions(@CurrentUser() user: AuthUser) {
    return this.webauthn.getRegistrationOptions(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("registration-verify")
  verifyRegistration(@CurrentUser() user: AuthUser, @Body() dto: RegistrationVerifyDto) {
    return this.webauthn.verifyRegistration(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("credentials")
  listCredentials(@CurrentUser() user: AuthUser) {
    return this.webauthn.listCredentials(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete("credentials/:id")
  removeCredential(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.webauthn.removeCredential(user.userId, id);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("login-options")
  getLoginOptions() {
    return this.webauthn.getLoginOptions();
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("login-verify")
  verifyLogin(@Body() dto: LoginVerifyDto) {
    return this.webauthn.verifyLogin(dto);
  }
}
