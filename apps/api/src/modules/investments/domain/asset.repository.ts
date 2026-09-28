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
  abstract findTransactionById(id: string): Promise<InvestmentTransaction | null>;
  abstract updateTransaction(id: string, data: Record<string, unknown>): Promise<InvestmentTransaction>;
  abstract deleteTransaction(id: string): Promise<void>;
  abstract addIncome(data: { userId: string; assetId: string; type: string; amount: number; paymentDate: Date; notes?: string }): Promise<InvestmentIncome>;
  abstract listIncomes(assetId: string): Promise<InvestmentIncome[]>;
  abstract findIncomeById(id: string): Promise<InvestmentIncome | null>;
  abstract updateIncome(id: string, data: Record<string, unknown>): Promise<InvestmentIncome>;
  abstract deleteIncome(id: string): Promise<void>;
  abstract sumIncomesByUser(userId: string, since?: Date): Promise<number>;
  /** All of a user's transactions across every asset, ticker included — used by the B3 import's
   *  dedup/backfill logic instead of listing assets then N+1-querying each one's transactions.
   *  Excludes soft-deleted assets' history: once an asset is deleted its old transactions/incomes
   *  shouldn't keep counting in the Lançamentos ledger or dashboard totals, and shouldn't be
   *  mistaken for "already imported" if the same ticker is re-added later. */
  abstract listAllTransactionsByUser(userId: string): Promise<(InvestmentTransaction & { asset: { ticker: string; class: string } })[]>;
  abstract listAllIncomesByUser(userId: string): Promise<(InvestmentIncome & { asset: { ticker: string; class: string } | null })[]>;
}
