import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { AssistantService } from "../application/assistant.service";
import { ChatDto } from "../application/dto/chat.dto";

@UseGuards(JwtAuthGuard)
@Controller("assistant")
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post("chat")
  async chat(@CurrentUser() user: AuthUser, @Body() dto: ChatDto) {
    return { messages: await this.assistant.chat(user.userId, dto.messages) };
  }
}
