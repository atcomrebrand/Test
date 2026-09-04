import { HouseholdBill, HouseholdBillCategory } from "@prisma/client";

export type HouseholdBillWithCategory = HouseholdBill & { category: HouseholdBillCategory | null };

export interface CreateHouseholdBillData {
  userId: string;
  categoryId?: string;
  name: string;
  dueDay: number;
  defaultAmount: number;
  allowAmountChange?: boolean;
  mandatory?: boolean;
  notes?: string;
}

export abstract class HouseholdBillRepository {
  abstract findAllByUser(userId: string): Promise<HouseholdBillWithCategory[]>;
  abstract findActiveByUser(userId: string): Promise<HouseholdBillWithCategory[]>;
  abstract findById(id: string): Promise<HouseholdBillWithCategory | null>;
  abstract create(data: CreateHouseholdBillData): Promise<HouseholdBillWithCategory>;
  abstract update(id: string, data: Record<string, unknown>): Promise<HouseholdBillWithCategory>;
  abstract delete(id: string): Promise<void>;
  abstract reorder(userId: string, ids: string[]): Promise<void>;
}
