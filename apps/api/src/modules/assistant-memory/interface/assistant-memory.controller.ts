import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../../../common/decorators/current-user.decorator";
import { AssistantMemoryService } from "../application/assistant-memory.service";
import { CreateAssistantMemoryDto } from "../application/dto/assistant-memory.dto";

@UseGuards(JwtAuthGuard)
@Controller("assistant/memories")
export class AssistantMemoryController {
  constructor(private readonly service: AssistantMemoryService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.service.findAll(user.userId);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAssistantMemoryDto) {
    return this.service.create(user.userId, dto.content);
  }

  @Delete(":id")
  delete(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.service.delete(user.userId, id);
  }
}
