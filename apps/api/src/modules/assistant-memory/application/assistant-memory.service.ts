import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AssistantMemoryRepository } from "../domain/assistant-memory.repository";

const MAX_CONTENT_LENGTH = 500;

@Injectable()
export class AssistantMemoryService {
  constructor(private readonly memories: AssistantMemoryRepository) {}

  findAll(userId: string) {
    return this.memories.findAllByUser(userId);
  }

  create(userId: string, content: string) {
    const trimmed = content.trim().slice(0, MAX_CONTENT_LENGTH);
    return this.memories.create(userId, trimmed);
  }

  async delete(userId: string, id: string) {
    const memory = await this.memories.findById(id);
    if (!memory) throw new NotFoundException("Memória não encontrada.");
    if (memory.userId !== userId) throw new ForbiddenException();
    await this.memories.delete(id);
    return { id };
  }
}
