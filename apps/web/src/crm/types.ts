export type CrmCustomerStatus =
  | "LEAD"
  | "TRIAL"
  | "ACTIVE"
  | "DUE_SOON"
  | "LATE"
  | "DELINQUENT"
  | "CANCELLED"
  | "INACTIVE"
  | "RECOVERY";

export type CrmLeadStage = "NEW" | "CONTACTED" | "INTERESTED" | "TRIAL" | "CONVERTED" | "LOST";
export type CrmResellerStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "NEGOTIATING" | "BLOCKED";
export type CrmActivity = "ACTIVE" | "ATTENTION" | "INACTIVE";
export type CrmBillingPeriod = "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "CUSTOM";
export type CrmTemplateCategory =
  | "RENEWAL"
  | "DUE"
  | "DELINQUENCY"
  | "RETENTION"
  | "SUPPORT"
  | "WELCOME"
  | "RESELLER"
  | "OTHER";

export interface CrmPortfolio {
  id: string;
  name: string;
  color: string;
  order: number;
  active: boolean;
}

export interface CrmPlan {
  id: string;
  portfolioId: string;
  name: string;
  price: string | number;
  billingPeriod: CrmBillingPeriod;
  customDays: number | null;
  active: boolean;
}

export interface CrmPaymentMethod {
  id: string;
  name: string;
  feePercent: string | number;
  feeFixed: string | number;
  active: boolean;
}

export interface CrmOrigin {
  id: string;
  name: string;
  active: boolean;
}

export interface CrmTag {
  id: string;
  name: string;
  color: string;
}

export interface CrmTenure {
  days: number;
  months: number;
  years: number;
  remainingMonths: number;
  label: string;
}

export interface CrmSubscription {
  id: string;
  customerId: string;
  portfolioId: string;
  planId: string | null;
  plan: CrmPlan | null;
  startDate: string;
  dueDate: string;
  amount: string | number;
  billingPeriod: CrmBillingPeriod;
  customDays: number | null;
  paymentMethodId: string | null;
  status: "ACTIVE" | "CANCELLED" | "EXPIRED";
  lastPaymentAt: string | null;
  notes: string | null;
}

export interface CrmPayment {
  id: string;
  customerId: string;
  subscriptionId: string | null;
  paidAt: string;
  grossAmount: string | number;
  feePercent: string | number;
  feeAmount: string | number;
  netAmount: string | number;
  paymentMethodName: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  reversedAt: string | null;
  notes: string | null;
}

export interface CrmCustomerEvent {
  id: string;
  kind: string;
  description: string;
  amount: string | number | null;
  createdAt: string;
}

export interface CrmCustomer {
  id: string;
  portfolioId: string;
  portfolio: CrmPortfolio;
  name: string;
  nickname: string | null;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  document: string | null;
  originId: string | null;
  origin: CrmOrigin | null;
  currentDueDate: string | null;
  manualStatus: CrmCustomerStatus | null;
  trialEndsAt: string | null;
  firstSubscribedAt: string | null;
  vip: boolean;
  vipManual: boolean;
  notes: string | null;
  tags: CrmTag[];
  subscriptions: CrmSubscription[];
  /** Derivados pelo servidor a cada leitura — não existem no banco. */
  status: CrmCustomerStatus;
  daysUntilDue: number | null;
  daysLate: number;
  tenure: CrmTenure | null;
  activeSubscription: CrmSubscription | null;
}

export interface CrmCustomerRevenue {
  total: number;
  last30: number;
  last6Months: number;
  last12Months: number;
  gross: number;
  fees: number;
  net: number;
  count: number;
  firstPaymentAt: string | null;
  lastPaymentAt: string | null;
}

export interface CrmCustomerDetail extends CrmCustomer {
  revenue: CrmCustomerRevenue;
  averageTicket: number | null;
  renewals: number;
  payments: CrmPayment[];
  events: CrmCustomerEvent[];
}

export interface CrmLead {
  id: string;
  portfolioId: string;
  portfolio: CrmPortfolio;
  name: string;
  phone: string;
  whatsapp: string | null;
  originId: string | null;
  origin: CrmOrigin | null;
  stage: CrmLeadStage;
  lastContactAt: string | null;
  nextContactAt: string | null;
  convertedCustomerId: string | null;
  convertedAt: string | null;
  lostReason: string | null;
  notes: string | null;
  tags: CrmTag[];
  createdAt: string;
}

export interface CrmLeadStats {
  total: number;
  converted: number;
  lost: number;
  conversionRate: number | null;
  convertedRevenue: number;
  byOrigin: { originId: string | null; originName: string; total: number; converted: number; rate: number | null }[];
  byStage: { stage: CrmLeadStage; count: number }[];
}

export interface CrmCreditPosition {
  resellerPortfolioId: string;
  balance: number;
  purchased: number;
  used: number;
  totalRecharges: number;
  totalSpent: number;
  lastRechargeAt: string | null;
}

export interface CrmResellerLink {
  id: string;
  resellerId: string;
  portfolioId: string;
  portfolio: CrmPortfolio;
  status: CrmResellerStatus;
  creditPrice: string | number;
  /** ESTIMATIVA informada à mão — não é contagem de clientes do CRM. */
  approxActiveClients: number;
  approxUpdatedAt: string | null;
  lowCreditThreshold: number;
  startedAt: string;
  notes: string | null;
  credits: CrmCreditPosition;
  activity: CrmActivity;
  daysSinceLastRecharge: number | null;
  lowCredit: boolean;
  tenure: CrmTenure | null;
}

export interface CrmReseller {
  id: string;
  name: string;
  companyName: string | null;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  notes: string | null;
  tags: CrmTag[];
  portfolios: CrmResellerLink[];
}

export interface CrmRecharge {
  id: string;
  date: string;
  quantity: number;
  unitPrice: string | number;
  totalAmount: string | number;
  paymentMethodName: string | null;
  feeAmount: string | number;
  netAmount: string | number;
  notes: string | null;
}

export interface CrmCreditMovement {
  id: string;
  kind: "RECHARGE" | "USAGE" | "ADJUSTMENT";
  quantity: number;
  rechargeId: string | null;
  note: string | null;
  createdAt: string;
}

export interface CrmResellerDetail extends CrmReseller {
  details: {
    linkId: string;
    recharges: CrmRecharge[];
    movements: CrmCreditMovement[];
    priceChanges: { id: string; previousPrice: string; newPrice: string; changedAt: string }[];
    approxChanges: { id: string; previousValue: number; newValue: number; changedAt: string }[];
    stats: {
      totalRecharges: number;
      totalCreditsPurchased: number;
      totalSpent: number;
      averageCreditPrice: number | null;
      rechargesPerMonth: number | null;
      creditsPerMonth: number | null;
    };
  }[];
}

export interface CrmDueCustomer {
  id: string;
  name: string;
  nickname: string | null;
  phone: string;
  whatsapp: string | null;
  currentDueDate: string | null;
  portfolio: { name: string; color: string };
  subscriptions: { id: string; amount: string | number; billingPeriod: CrmBillingPeriod }[];
}

export interface CrmDashboard {
  customers: {
    total: number;
    active: number;
    dueToday: number;
    dueTomorrow: number;
    dueIn3Days: number;
    dueIn7Days: number;
    dueIn30Days: number;
    late: number;
    delinquent: number;
    trial: number;
    cancelled: number;
    inactive: number;
    newThisMonth: number;
    recovered: number;
    lost: number;
  };
  financial: CrmFinancial;
  dueBoard: {
    today: { count: number; customers: CrmDueCustomer[] };
    tomorrow: { count: number; customers: CrmDueCustomer[] };
    next3Days: { count: number };
    next7Days: { count: number };
    next30Days: { count: number };
    late: { count: number; customers: CrmDueCustomer[] };
  };
  resellers: CrmResellerDashboard;
  churn: { lost: number; gained: number; netGrowth: number; churnRate: number | null; growthRate: number | null };
  alerts: { kind: string; tone: "info" | "warning" | "danger"; message: string }[];
}

export interface CrmFinancial {
  period: string;
  from: string;
  to: string;
  /** As duas origens nunca aparecem sem o total, nem o total sem elas. */
  revenue: { direct: number; reseller: number; total: number };
  gross: number;
  fees: number;
  net: number;
  pending: { amount: number; count: number };
  paymentsCount: number;
  rechargesCount: number;
  averageTicket: number | null;
  averageRechargeTicket: number | null;
  byPaymentMethod: { name: string; total: number; count: number }[];
  byPlan: { planId: string | null; name: string; monthlyRecurring: number; count: number }[];
}

export interface CrmResellerDashboard {
  total: number;
  active: number;
  attention: number;
  inactive: number;
  lowCredit: number;
  creditsSold: number;
  creditsUsed: number;
  creditsAvailable: number;
  totalRecharges: number;
  rechargeRevenue: number;
  averageRechargeTicket: number | null;
  averageCreditsPerRecharge: number | null;
  /** Soma de estimativas — a UI é obrigada a rotular como estimativa. */
  approxActiveClients: number;
  ranking: {
    resellerId: string;
    resellerName: string;
    linkId: string;
    portfolioId: string;
    portfolioName: string;
    portfolioColor: string;
    balance: number;
    totalSpent: number;
    creditsPurchased: number;
    recharges: number;
    approxActiveClients: number;
    lastRechargeAt: string | null;
    activity: CrmActivity;
  }[];
}

export interface CrmComparison {
  portfolio: CrmPortfolio;
  customers: number;
  activeCustomers: number;
  resellers: number;
  estimatedResellerClients: number;
  revenue: { direct: number; reseller: number; total: number };
  churnRate: number | null;
  netGrowth: number;
}

export interface CrmRetentionPoint {
  months: number;
  eligible: number;
  retained: number;
  rate: number | null;
}

export interface CrmMessageTemplate {
  id: string;
  name: string;
  category: CrmTemplateCategory;
  body: string;
  forReseller: boolean;
  active: boolean;
  order: number;
}

export interface CrmRenderedMessage {
  text: string;
  missing: string[];
  phone: string | null;
  whatsappUrl: string | null;
}

export interface CrmSettings {
  vipMinMonths: number | null;
  vipMinRevenue: string | null;
  vipMinRenewals: number | null;
  resellerAttentionDays: number;
  resellerInactiveDays: number;
  defaultLowCreditThreshold: number;
}

export interface CrmSearchResults {
  customers: (CrmDueCustomer & { status: CrmCustomerStatus; daysUntilDue: number | null; daysLate: number })[];
  leads: { id: string; name: string; phone: string; stage: CrmLeadStage; portfolio: { name: string; color: string } }[];
  resellers: {
    id: string;
    name: string;
    companyName: string | null;
    phone: string;
    whatsapp: string | null;
    portfolios: { id: string; portfolio: { name: string; color: string } }[];
  }[];
}
