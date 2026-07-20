import { InvestmentAsset, InvestmentIncome, InvestmentTransaction } from "@prisma/client";

export interface CreateAssetData {
  userId: string;
  class: string;
  ticker: string;
  name?: string;
  broker?: string;
  wallet?: string;
  network?: string;
  notes?: string;
  stakingApyPercent?: number;
}

export interface CreateTransactionData {
  userId: string;
  assetId: string;
  type: string;
  quantity: number;
  unitPrice: number;
  fees: number;
  transactionDate: Date;
  notes?: string;
}

export abstract class AssetRepository {
  abstract findAllByUser(userId: string, assetClass?: string): Promise<InvestmentAsset[]>;
  abstract findById(id: string): Promise<InvestmentAsset | null>;
  abstract findByUserAndTicker(userId: string, assetClass: string, ticker: string): Promise<InvestmentAsset | null>;
  abstract findByIdWithTransactions(id: string): Promise<(InvestmentAsset & { transactions: InvestmentTransaction[]; incomes: InvestmentIncome[] }) | null>;
  abstract create(data: CreateAssetData): Promise<InvestmentAsset>;
  abstract update(id: string, data: Record<string, unknown>): Promise<InvestmentAsset>;
  abstract softDelete(id: string): Promise<void>;
  abstract addTransaction(data: CreateTransactionData): Promise<InvestmentTransaction>;
  abstract listTransactions(assetId: string): Promise<InvestmentTransaction[]>;
  abstract addIncome(data: { userId: string; assetId: string; type: string; amount: number; paymentDate: Date; notes?: string }): Promise<InvestmentIncome>;
  abstract listIncomes(assetId: string): Promise<InvestmentIncome[]>;
  abstract sumIncomesByUser(userId: string, since?: Date): Promise<number>;
}
