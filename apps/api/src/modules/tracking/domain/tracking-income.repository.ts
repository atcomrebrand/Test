import { TrackingIncome } from "@prisma/client";

export interface CreateTrackingIncomeData {
  userId: string;
  name: string;
  category?: string;
  amount: number;
  date: Date;
  notes?: string;
}

export abstract class TrackingIncomeRepository {
  abstract findAllByUser(userId: string): Promise<TrackingIncome[]>;
  abstract findById(id: string): Promise<TrackingIncome | null>;
  abstract create(data: CreateTrackingIncomeData): Promise<TrackingIncome>;
  abstract update(id: string, data: Record<string, unknown>): Promise<TrackingIncome>;
  abstract softDelete(id: string): Promise<void>;
}
