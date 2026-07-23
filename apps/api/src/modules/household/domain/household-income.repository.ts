import { HouseholdIncome, HouseholdIncomeCategory } from "@prisma/client";

export type HouseholdIncomeWithCategory = HouseholdIncome & { category: HouseholdIncomeCategory | null };

export interface CreateHouseholdIncomeData {
  userId: string;
  categoryId?: string;
  date: Date;
  description?: string;
  amount: number;
  notes?: string;
}

export abstract class HouseholdIncomeRepository {
  abstract findAllByUser(userId: string): Promise<HouseholdIncomeWithCategory[]>;
  abstract findByMonth(userId: string, referenceYear: number, referenceMonth: number): Promise<HouseholdIncomeWithCategory[]>;
  abstract findById(id: string): Promise<HouseholdIncomeWithCategory | null>;
  abstract create(data: CreateHouseholdIncomeData): Promise<HouseholdIncomeWithCategory>;
  abstract update(id: string, data: Record<string, unknown>): Promise<HouseholdIncomeWithCategory>;
  abstract delete(id: string): Promise<void>;
}
