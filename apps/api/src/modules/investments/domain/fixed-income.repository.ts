import { InvestmentFixedIncome, InvestmentIncome } from "@prisma/client";

export interface CreateFixedIncomeData {
  userId: string;
  institution: string;
  type: string;
  principalAmount: number;
  /** Só o resgate parcial passa isto: a fatia sacada nasce com o aporte que lhe cabe, e não com o
   *  principal proporcional. Omitido em qualquer aplicação normal — aí os dois são iguais. */
  contributedAmount?: number;
  applicationDate: Date;
  maturityDate: Date;
  liquidity: string;
  indexer: string;
  fixedRatePercent?: number;
  cdiPercent?: number;
  notes?: string;
}

export abstract class FixedIncomeRepository {
  abstract findAllByUser(userId: string): Promise<InvestmentFixedIncome[]>;
  abstract findById(id: string): Promise<InvestmentFixedIncome | null>;
  abstract create(data: CreateFixedIncomeData): Promise<InvestmentFixedIncome>;
  abstract update(id: string, data: Record<string, unknown>): Promise<InvestmentFixedIncome>;
  abstract softDelete(id: string): Promise<void>;
  abstract redeem(id: string, redeemedAt: Date, redeemedNetAmount: number): Promise<InvestmentFixedIncome>;
  abstract unredeem(id: string): Promise<InvestmentFixedIncome>;
  abstract addIncome(data: {
    userId: string;
    fixedIncomeId: string;
    type: string;
    amount: number;
    paymentDate: Date;
    notes?: string;
  }): Promise<InvestmentIncome>;
  abstract listIncomes(fixedIncomeId: string): Promise<InvestmentIncome[]>;
}
