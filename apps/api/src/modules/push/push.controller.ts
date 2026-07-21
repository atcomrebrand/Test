import { Body, Controller, Delete, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../common/decorators/current-user.decorator";
import { PushService } from "./push.service";
import { SubscribeDto, UnsubscribeDto } from "./dto/push.dto";

@UseGuards(JwtAuthGuard)
@Controller("push")
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get("vapid-public-key")
  vapidPublicKey() {
    return { publicKey: this.push.getPublicKey() };
  }

  @Get("status")
  async status(@CurrentUser() user: AuthUser) {
    return { subscribed: await this.push.isSubscribed(user.userId) };
  }

  @Post("subscribe")
  subscribe(@CurrentUser() user: AuthUser, @Body() dto: SubscribeDto) {
    return this.push.subscribe(user.userId, dto);
  }

  @Post("unsubscribe")
  unsubscribe(@CurrentUser() user: AuthUser, @Body() dto: UnsubscribeDto) {
    return this.push.unsubscribe(user.userId, dto.endpoint);
  }

  @Post("test")
  async test(@CurrentUser() user: AuthUser) {
    await this.push.notifyUser(user.userId, {
      title: "Ferramentas do Mauro",
      body: "Notificações ativadas com sucesso! 🎉",
    });
    return { sent: true };
  }
}
