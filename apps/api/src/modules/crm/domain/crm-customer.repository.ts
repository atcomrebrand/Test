import {
  CrmCustomer,
  CrmCustomerEvent,
  CrmOrigin,
  CrmPayment,
  CrmPlan,
  CrmPortfolio,
  CrmSubscription,
  CrmTag,
} from "@prisma/client";

export type CustomerWithRelations = CrmCustomer & {
  portfolio: CrmPortfolio;
  origin: CrmOrigin | null;
  tags: { tag: CrmTag }[];
  subscriptions: (CrmSubscription & { plan: CrmPlan | null })[];
};

export type SubscriptionWithPlan = CrmSubscription & { plan: CrmPlan | null };

export interface CustomerFilters {
  portfolioId?: string;
  /** Janela de vencimento em dias a partir de hoje. 0 = vence hoje. */
  dueWithinDays?: number;
  /** Só quem está vencido. */
  onlyLate?: boolean;
  originId?: string;
  tagIds?: string[];
  search?: string;
  includeDeleted?: boolean;
}

export interface CreateCustomerData {
  portfolioId: string;
  name: string;
  nickname?: string | null;
  phone: string;
  whatsapp?: string | null;
  email?: string | null;
  document?: string | null;
  originId?: string | null;
  referredById?: string | null;
  trialEndsAt?: Date | null;
  notes?: string | null;
  tagIds?: string[];
}

export interface RenewData {
  userId: string;
  subscriptionId: string;
  customerId: string;
  portfolioId: string;
  amount: number;
  /** Novo vencimento já calculado pelo domínio. */
  nextDueDate: Date;
  paidAt: Date;
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  feePercent: number;
  feeFixed: number;
  feeAmount: number;
  netAmount: number;
  periodStart: Date;
  periodEnd: Date;
  notes?: string | null;
  /** Preenchido só quando é a primeira assinatura do cliente. */
  firstSubscribedAt?: Date | null;
  /**
   * Créditos do painel que esta renovação consome. Debitado dentro da mesma transação: pagamento
   * gravado sem baixa de crédito faria o saldo desviar do painel real a cada renovação, em silêncio.
   */
  creditCost: number;
}

export interface CustomerRevenue {
  total: number;
  last30: number;
  last6Months: number;
  last12Months: number;
  gross: number;
  fees: number;
  net: number;
  count: number;
  firstPaymentAt: Date | null;
  lastPaymentAt: Date | null;
}

export abstract class CrmCustomerRepository {
  abstract list(userId: string, filters: CustomerFilters): Promise<CustomerWithRelations[]>;
  abstract findById(userId: string, id: string): Promise<CustomerWithRelations | null>;
  abstract create(userId: string, data: CreateCustomerData): Promise<CustomerWithRelations>;
  abstract update(id: string, data: Record<string, unknown>, tagIds?: string[]): Promise<CustomerWithRelations>;
  abstract softDelete(id: string): Promise<void>;

  abstract listSubscriptions(userId: string, customerId: string): Promise<SubscriptionWithPlan[]>;
  abstract findSubscription(userId: string, id: string): Promise<SubscriptionWithPlan | null>;
  abstract findActiveSubscription(userId: string, customerId: string): Promise<SubscriptionWithPlan | null>;
  abstract createSubscription(userId: string, data: Record<string, unknown>): Promise<SubscriptionWithPlan>;
  abstract updateSubscription(id: string, data: Record<string, unknown>): Promise<SubscriptionWithPlan>;

  /**
   * Renovação: pagamento, vencimento da assinatura, vencimento do cliente e evento de timeline numa
   * transação só. Metade disso aplicado (pagamento gravado, vencimento não) deixaria o cliente
   * pagando e continuando vencido — exatamente o erro que o operador não tem como perceber.
   */
  abstract renew(data: RenewData): Promise<{ subscription: SubscriptionWithPlan; payment: CrmPayment }>;

  abstract listPayments(userId: string, customerId: string): Promise<CrmPayment[]>;
  abstract findPayment(userId: string, id: string): Promise<CrmPayment | null>;
  abstract createPayment(userId: string, data: Record<string, unknown>): Promise<CrmPayment>;
  abstract reversePayment(id: string): Promise<CrmPayment>;
  abstract computeRevenue(userId: string, customerId: string, today: Date): Promise<CustomerRevenue>;

  abstract listEvents(userId: string, customerId: string): Promise<CrmCustomerEvent[]>;
  abstract addEvent(
    userId: string,
    customerId: string,
    kind: string,
    description: string,
    amount?: number | null,
  ): Promise<CrmCustomerEvent>;

  /** Quantas renovações o cliente já teve — critério de VIP. */
  abstract countRenewals(userId: string, customerId: string): Promise<number>;
}
