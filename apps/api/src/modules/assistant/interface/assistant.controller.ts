import { Body, Controller, Get, Post, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { AssistantService } from "../application/assistant.service";
import { ChatDto } from "../application/dto/chat.dto";
import { SpeakDto } from "../application/dto/speak.dto";
import { ElevenLabsProvider } from "../infrastructure/elevenlabs.provider";

@UseGuards(JwtAuthGuard)
@Controller("assistant")
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly elevenLabs: ElevenLabsProvider,
  ) {}

  @Post("chat")
  async chat(@CurrentUser() user: AuthUser, @Body() dto: ChatDto) {
    return { messages: await this.assistant.chat(user.userId, dto.messages) };
  }

  @Get("voices")
  async voices() {
    return this.elevenLabs.listVoices();
  }

  @Post("speak")
  async speak(@Body() dto: SpeakDto, @Res() res: Response) {
    const audio = await this.elevenLabs.synthesize(dto.text, dto.voiceId);
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audio);
  }
}
