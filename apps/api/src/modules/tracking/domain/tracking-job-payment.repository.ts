import { TrackingCurrency, TrackingJobPayment } from "@prisma/client";

export interface CreateTrackingJobPaymentData {
  userId: string;
  jobId: string;
  referenceYear: number;
  referenceMonth: number;
  amount: number;
  currency: TrackingCurrency;
  exchangeRate: number | null;
  amountBRL: number;
}

export abstract class TrackingJobPaymentRepository {
  /** Map of jobId -> amountBRL, for every job in `jobIds` confirmed for that reference month. */
  abstract findForJobsAndMonth(jobIds: string[], referenceYear: number, referenceMonth: number): Promise<Map<string, number>>;
  abstract findByJobAndMonth(jobId: string, referenceYear: number, referenceMonth: number): Promise<TrackingJobPayment | null>;
  /** Confirming twice for the same job/month replaces the previous confirmation (upsert). */
  abstract upsert(data: CreateTrackingJobPaymentData): Promise<TrackingJobPayment>;
  abstract findAllByJob(jobId: string): Promise<TrackingJobPayment[]>;
}
