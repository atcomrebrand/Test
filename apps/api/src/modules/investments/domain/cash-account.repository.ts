import { InvestmentCashAccount } from "@prisma/client";

export interface CreateCashAccountData {
  userId: string;
  name: string;
  institution?: string;
  balance: number;
  notes?: string;
}

export abstract class CashAccountRepository {
  abstract findAllByUser(userId: string): Promise<InvestmentCashAccount[]>;
  abstract findById(id: string): Promise<InvestmentCashAccount | null>;
  abstract create(data: CreateCashAccountData): Promise<InvestmentCashAccount>;
  abstract update(id: string, data: Record<string, unknown>): Promise<InvestmentCashAccount>;
  abstract softDelete(id: string): Promise<void>;
  abstract sumBalancesByUser(userId: string): Promise<number>;
}
