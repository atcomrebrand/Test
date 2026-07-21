import { TrackingJob } from "@prisma/client";

export interface CreateTrackingJobData {
  userId: string;
  type?: "FIXO" | "FREELANCE";
  name: string;
  company: string;
  client?: string;
  monthlyValue?: number;
  totalAgreedValue?: number;
  currency?: "BRL" | "USD";
  expectedHoursPerDay?: number;
  startDate: Date;
  endDate?: Date;
  paymentMethod?: string;
  paymentDay?: number;
  color?: string;
  weekdays?: number[];
  notes?: string;
}

export abstract class TrackingJobRepository {
  abstract findAllByUser(userId: string): Promise<TrackingJob[]>;
  abstract findById(id: string): Promise<TrackingJob | null>;
  abstract create(data: CreateTrackingJobData): Promise<TrackingJob>;
  abstract update(id: string, data: Record<string, unknown>): Promise<TrackingJob>;
  abstract softDelete(id: string): Promise<void>;
}
