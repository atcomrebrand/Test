import { HouseholdCard, HouseholdCardEntry } from "@prisma/client";

export type HouseholdCardEntryWithCard = HouseholdCardEntry & { card: HouseholdCard };

export interface CreateHouseholdCardEntryData {
  userId: string;
  cardId: string;
  referenceYear: number;
  referenceMonth: number;
  totalInvoice: number;
  provisioned?: number;
}

export interface UpdateHouseholdCardEntryData {
  totalInvoice?: number;
  provisioned?: number;
  paid?: boolean;
  paidAt?: Date | null;
  notes?: string;
}

export abstract class HouseholdCardEntryRepository {
  abstract findByMonth(userId: string, referenceYear: number, referenceMonth: number): Promise<HouseholdCardEntryWithCard[]>;
  abstract findExistingCardIdsForMonth(userId: string, referenceYear: number, referenceMonth: number): Promise<Set<string>>;
  abstract createMany(entries: CreateHouseholdCardEntryData[]): Promise<void>;
  abstract findById(id: string): Promise<HouseholdCardEntryWithCard | null>;
  abstract findByCardAndMonth(cardId: string, referenceYear: number, referenceMonth: number): Promise<HouseholdCardEntryWithCard | null>;
  abstract update(id: string, data: UpdateHouseholdCardEntryData): Promise<HouseholdCardEntryWithCard>;
}
