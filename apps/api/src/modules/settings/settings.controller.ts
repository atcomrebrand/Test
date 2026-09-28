import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { SettingsService } from "./settings.service";
import { UpdateSettingsDto } from "./dto/settings.dto";

@UseGuards(JwtAuthGuard)
@Controller("settings")
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.service.get(user.userId);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    return this.service.update(user.userId, dto);
  }
}
