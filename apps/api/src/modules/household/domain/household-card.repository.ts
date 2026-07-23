import { HouseholdCard } from "@prisma/client";

export interface CreateHouseholdCardData {
  userId: string;
  name: string;
  closingDay: number;
  dueDay: number;
  color?: string;
  icon?: string;
}

export abstract class HouseholdCardRepository {
  abstract findAllByUser(userId: string): Promise<HouseholdCard[]>;
  abstract findActiveByUser(userId: string): Promise<HouseholdCard[]>;
  abstract findById(id: string): Promise<HouseholdCard | null>;
  abstract create(data: CreateHouseholdCardData): Promise<HouseholdCard>;
  abstract update(id: string, data: Record<string, unknown>): Promise<HouseholdCard>;
  abstract delete(id: string): Promise<void>;
  abstract countEntries(cardId: string): Promise<number>;
}
