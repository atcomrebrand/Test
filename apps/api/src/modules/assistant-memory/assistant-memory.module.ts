import { Module } from "@nestjs/common";
import { AssistantMemoryController } from "./interface/assistant-memory.controller";
import { AssistantMemoryService } from "./application/assistant-memory.service";
import { AssistantMemoryRepository } from "./domain/assistant-memory.repository";
import { AssistantMemoryPrismaRepository } from "./infrastructure/assistant-memory.prisma.repository";

@Module({
  controllers: [AssistantMemoryController],
  providers: [AssistantMemoryService, { provide: AssistantMemoryRepository, useClass: AssistantMemoryPrismaRepository }],
  exports: [AssistantMemoryService],
})
export class AssistantMemoryModule {}
