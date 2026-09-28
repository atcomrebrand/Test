import { AssistantMemory } from "@prisma/client";

export abstract class AssistantMemoryRepository {
  abstract findAllByUser(userId: string): Promise<AssistantMemory[]>;
  abstract findById(id: string): Promise<AssistantMemory | null>;
  abstract create(userId: string, content: string): Promise<AssistantMemory>;
  abstract delete(id: string): Promise<void>;
}
