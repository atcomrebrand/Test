import { Purchase } from "@prisma/client";
import { GeneratedInstallment } from "./installment-generator";

export interface PurchaseFilters {
  userId: string;
  search?: string;
  cardId?: string;
  categoryId?: string;
  year?: number;
  month?: number;
  minAmount?: number;
  maxAmount?: number;
  kind?: string;
  favorite?: boolean;
  trashed?: boolean;
  page: number;
  pageSize: number;
}

export interface CreatePurchaseWithInstallments {
  purchase: {
    userId: string;
    cardId: string;
    categoryId?: string;
    name: string;
    merchant?: string;
    notes?: string;
    totalAmount: number;
    purchaseDate: Date;
    kind: string;
    installmentsCount: number;
    downPayment?: number;
    isRecurring?: boolean;
    recurrenceEndDate?: Date;
    tags?: string[];
    isFavorite?: boolean;
    attachmentUrl?: string;
    attachmentName?: string;
  };
  installments: GeneratedInstallment[];
  cardId: string;
}

export interface RecurringPurchaseForExtension {
  id: string;
  cardId: string;
  purchaseDate: Date;
  monthlyAmount: number;
  recurrenceEndDate: Date | null;
  installmentsCount: number;
  latestReferenceYear: number;
  latestReferenceMonth: number;
}

export abstract class PurchaseRepository {
  abstract findManyPaginated(filters: PurchaseFilters): Promise<{ items: Purchase[]; total: number }>;
  abstract findById(id: string): Promise<Purchase | null>;
  abstract findByIdWithInstallments(id: string): Promise<any>;
  abstract createWithInstallments(data: CreatePurchaseWithInstallments): Promise<Purchase>;
  abstract update(id: string, data: Record<string, unknown>): Promise<Purchase>;
  abstract softDelete(id: string): Promise<void>;
  abstract restore(id: string): Promise<void>;
  abstract hardDelete(id: string): Promise<void>;
  abstract recentByUser(userId: string, limit: number): Promise<Purchase[]>;
  abstract findActiveRecurringForExtension(userId: string): Promise<RecurringPurchaseForExtension[]>;
  abstract appendRecurringOccurrences(
    purchaseId: string,
    userId: string,
    cardId: string,
    occurrences: GeneratedInstallment[],
    newInstallmentsCount: number,
  ): Promise<void>;
  abstract cancelFutureRecurringOccurrences(purchaseId: string, afterKey: number, recurrenceEndDate: Date): Promise<void>;
}
