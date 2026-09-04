import { HouseholdBillEntry, HouseholdBillStatus } from "@prisma/client";
import { HouseholdBillWithCategory } from "./household-bill.repository";

export type HouseholdBillEntryWithBill = HouseholdBillEntry & { bill: HouseholdBillWithCategory };

export interface CreateHouseholdBillEntryData {
  userId: string;
  billId: string;
  referenceYear: number;
  referenceMonth: number;
  dueDate: Date;
  amount: number;
  status: HouseholdBillStatus;
}

export interface UpdateHouseholdBillEntryData {
  amount?: number;
  reservedAmount?: number;
  paidAmount?: number;
  status?: HouseholdBillStatus;
  skipped?: boolean;
  paidAt?: Date | null;
  notes?: string;
}

export abstract class HouseholdBillEntryRepository {
  /** All entries for a competência, one user, with the bill (+ its category) eager-loaded — the
   *  monthly table screen and the dashboard both read straight from this. */
  abstract findByMonth(userId: string, referenceYear: number, referenceMonth: number): Promise<HouseholdBillEntryWithBill[]>;
  abstract findExistingBillIdsForMonth(userId: string, referenceYear: number, referenceMonth: number): Promise<Set<string>>;
  abstract createMany(entries: CreateHouseholdBillEntryData[]): Promise<void>;
  abstract findById(id: string): Promise<HouseholdBillEntryWithBill | null>;
  abstract update(id: string, data: UpdateHouseholdBillEntryData): Promise<HouseholdBillEntryWithBill>;
  abstract countByBill(billId: string): Promise<number>;
}
