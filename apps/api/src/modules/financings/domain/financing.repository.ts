import { Financing, FinancingInstallment } from "@prisma/client";
import { GeneratedFixedInstallment } from "./financing-installment-generator";

export interface CreateFinancingData {
  userId: string;
  name: string;
  kind: string;
  institution?: string;
  totalAmount: number;
  installmentAmount: number;
  installmentsCount: number;
  firstDueDate: Date;
  payoffAmount?: number;
  payoffQuotedAt?: Date;
  notes?: string;
}

export abstract class FinancingRepository {
  abstract findAllByUser(userId: string): Promise<(Financing & { installments: FinancingInstallment[] })[]>;
  abstract findById(id: string): Promise<Financing | null>;
  abstract findByIdWithInstallments(id: string): Promise<(Financing & { installments: FinancingInstallment[] }) | null>;
  abstract createWithInstallments(data: CreateFinancingData, installments: GeneratedFixedInstallment[]): Promise<Financing>;
  abstract update(id: string, data: Record<string, unknown>): Promise<Financing>;
  abstract delete(id: string): Promise<void>;
  abstract refreshLateStatuses(userId: string): Promise<void>;
  abstract payInstallment(userId: string, id: string, paidAmount: number): Promise<FinancingInstallment>;
  abstract unpayInstallment(id: string): Promise<FinancingInstallment>;
  abstract updateInstallmentStatus(id: string, status: string): Promise<FinancingInstallment>;
  abstract findInstallmentById(id: string): Promise<FinancingInstallment | null>;
  abstract summary(userId: string): Promise<{
    totalActive: number;
    committedThisMonth: number;
    totalRemaining: number;
    totalPaid: number;
    nextInstallment: { financingId: string; financingName: string; dueDate: Date; amount: number } | null;
  }>;
  abstract addPayoffQuote(userId: string, financingId: string, amount: number, quotedAt: Date): Promise<void>;
  /** Quotes for this financing recorded on/after `since`, oldest first. */
  abstract listPayoffQuotesSince(financingId: string, since: Date): Promise<{ amount: number; quotedAt: Date }[]>;
  /** Every quote ever recorded for this financing, most recent first — for the full history view. */
  abstract listPayoffQuotes(financingId: string): Promise<{ amount: number; quotedAt: Date }[]>;
}
