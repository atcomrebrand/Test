import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { AssistantMemoryRepository } from "../domain/assistant-memory.repository";

@Injectable()
export class AssistantMemoryPrismaRepository extends AssistantMemoryRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  findAllByUser(userId: string) {
    return this.prisma.assistantMemory.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }

  findById(id: string) {
    return this.prisma.assistantMemory.findUnique({ where: { id } });
  }

  create(userId: string, content: string) {
    return this.prisma.assistantMemory.create({ data: { userId, content } });
  }

  async delete(id: string) {
    await this.prisma.assistantMemory.delete({ where: { id } });
  }
}
