import {
  CrmApproxClientsChange,
  CrmCreditMovement,
  CrmCreditPriceChange,
  CrmPortfolio,
  CrmRecharge,
  CrmReseller,
  CrmResellerPortfolio,
  CrmTag,
} from "@prisma/client";

export type ResellerPortfolioWithPortfolio = CrmResellerPortfolio & { portfolio: CrmPortfolio };

export type ResellerWithRelations = CrmReseller & {
  portfolios: ResellerPortfolioWithPortfolio[];
  tags: { tag: CrmTag }[];
};

export interface ResellerFilters {
  portfolioId?: string;
  status?: string;
  search?: string;
  /** Só os que estão no limite ou abaixo do próprio threshold. */
  onlyLowCredit?: boolean;
}

export interface CreateRechargeData {
  userId: string;
  resellerPortfolioId: string;
  portfolioId: string;
  date: Date;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  feePercent: number;
  feeFixed: number;
  feeAmount: number;
  netAmount: number;
  notes?: string | null;
}

/** Saldo e agregados de um vínculo, todos derivados. */
export interface CreditPosition {
  resellerPortfolioId: string;
  balance: number;
  purchased: number;
  used: number;
  totalRecharges: number;
  totalSpent: number;
  lastRechargeAt: Date | null;
}

export abstract class CrmResellerRepository {
  abstract list(userId: string, filters: ResellerFilters): Promise<ResellerWithRelations[]>;
  abstract findById(userId: string, id: string): Promise<ResellerWithRelations | null>;
  abstract create(userId: string, data: Record<string, unknown>, tagIds?: string[]): Promise<ResellerWithRelations>;
  abstract update(id: string, data: Record<string, unknown>, tagIds?: string[]): Promise<ResellerWithRelations>;
  abstract softDelete(id: string): Promise<void>;

  abstract findLink(userId: string, id: string): Promise<ResellerPortfolioWithPortfolio | null>;
  abstract findLinkByPair(
    userId: string,
    resellerId: string,
    portfolioId: string,
  ): Promise<ResellerPortfolioWithPortfolio | null>;
  abstract createLink(userId: string, data: Record<string, unknown>): Promise<ResellerPortfolioWithPortfolio>;
  abstract updateLink(id: string, data: Record<string, unknown>): Promise<ResellerPortfolioWithPortfolio>;

  /**
   * Recarga: linha de recarga + movimentação de crédito numa transação. Gravar a recarga sem a
   * movimentação faria o saldo — que é a soma das movimentações — simplesmente ignorar o dinheiro
   * que entrou.
   */
  abstract createRecharge(data: CreateRechargeData): Promise<{ recharge: CrmRecharge; movement: CrmCreditMovement }>;
  abstract listRecharges(userId: string, resellerPortfolioId: string): Promise<CrmRecharge[]>;

  abstract addMovement(
    userId: string,
    resellerPortfolioId: string,
    kind: string,
    quantity: number,
    note?: string | null,
  ): Promise<CrmCreditMovement>;
  abstract listMovements(userId: string, resellerPortfolioId: string): Promise<CrmCreditMovement[]>;

  /** Posições de vários vínculos de uma vez — evita N+1 na listagem. */
  abstract creditPositions(userId: string, resellerPortfolioIds: string[]): Promise<CreditPosition[]>;

  abstract recordPriceChange(
    userId: string,
    resellerPortfolioId: string,
    previousPrice: number,
    newPrice: number,
  ): Promise<CrmCreditPriceChange>;
  abstract listPriceChanges(userId: string, resellerPortfolioId: string): Promise<CrmCreditPriceChange[]>;

  abstract recordApproxChange(
    userId: string,
    resellerPortfolioId: string,
    previousValue: number,
    newValue: number,
  ): Promise<CrmApproxClientsChange>;
  abstract listApproxChanges(userId: string, resellerPortfolioId: string): Promise<CrmApproxClientsChange[]>;
}
