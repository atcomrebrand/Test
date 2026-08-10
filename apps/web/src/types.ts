export type CardBrand = "VISA" | "MASTERCARD" | "ELO" | "AMEX" | "HIPERCARD" | "OTHER";
export type InstallmentStatus = "PENDING" | "PAID" | "LATE" | "CANCELLED";
export type PurchaseKind = "INSTALLMENT" | "CASH" | "RECURRING";
export type Theme = "LIGHT" | "DARK" | "SYSTEM";

export interface CreditCard {
  id: string;
  name: string;
  bank: string;
  brand: CardBrand;
  color: string;
  limitAmount: string | number;
  lastDigits: string;
  closingDay: number;
  dueDay: number;
  active: boolean;
  createdAt: string;
}

export interface Category {
  id: string;
  userId: string | null;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
}

export interface Purchase {
  id: string;
  userId: string;
  cardId: string;
  categoryId: string | null;
  name: string;
  merchant: string | null;
  notes: string | null;
  totalAmount: string | number;
  purchaseDate: string;
  kind: PurchaseKind;
  installmentsCount: number;
  downPayment: string | number | null;
  isRecurring: boolean;
  recurrenceEndDate: string | null;
  billingCycle: "MONTHLY" | "ANNUAL" | null;
  autoRenew: boolean | null;
  tags: string[];
  isFavorite: boolean;
  attachmentUrl: string | null;
  attachmentName: string | null;
  deletedAt: string | null;
  createdAt: string;
  card: CreditCard;
  category: Category | null;
  installments?: Installment[];
}

export interface Payment {
  id: string;
  amountPaid: string | number;
  paidAt: string;
  method: string | null;
}

export interface Installment {
  id: string;
  purchaseId: string;
  cardId: string;
  number: number;
  amount: string | number;
  referenceMonth: number;
  referenceYear: number;
  dueDate: string;
  status: InstallmentStatus;
  payment?: Payment | null;
  purchase?: Purchase;
  card?: CreditCard;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DashboardSummary {
  committedThisMonth: number;
  committedNextMonth: number;
  estimatedNextInvoice: number;
  totalRemaining: number;
  openInstallmentsCount: number;
  recentPurchases: Purchase[];
  nextClosing: { cardId: string; cardName: string; date: string } | null;
  nextDue: { cardId: string; cardName: string; date: string } | null;
  limitUsage: { totalLimit: number; totalSpent: number; usagePct: number };
  includeFinancingInTotals: boolean;
  financing: {
    activeCount: number;
    committedThisMonth: number;
    totalRemaining: number;
    lateCount: number;
  };
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Settings {
  theme: Theme;
  currency: string;
  alertLimitWarning: boolean;
  alertSpendingJump: boolean;
  limitWarningPct: number;
  dashboardWidgets: string[];
  includeFinancingInTotals: boolean;
  biometricLockEnabled: boolean;
}

export type FinancingKind = "CAR" | "MOTORCYCLE" | "HOUSE" | "OTHER";
export type FinancingInstallmentStatus = "PENDING" | "PAID" | "LATE" | "CANCELLED";

export interface FinancingInstallment {
  id: string;
  financingId: string;
  number: number;
  amount: string | number;
  dueDate: string;
  status: FinancingInstallmentStatus;
  paidAt: string | null;
  paidAmount: string | number | null;
}

/** Patrimônio de um bem financiado: o que ele vale hoje menos o que falta pra quitar. */
export interface FinancingEquity {
  /** null quando o bem ainda não tem valor informado. */
  assetValue: number | null;
  debt: number;
  debtSource: "PAYOFF_QUOTE" | "REMAINING_INSTALLMENTS";
  /** null (não zero) sem valor do bem — desconhecido não é o mesmo que "não vale nada". */
  equity: number | null;
  equityPercent: number | null;
  /** Deve-se mais do que o bem vale. */
  underwater: boolean;
}

export interface Financing {
  id: string;
  userId: string;
  name: string;
  kind: FinancingKind;
  institution: string | null;
  totalAmount: string | number;
  installmentAmount: string | number;
  installmentsCount: number;
  firstDueDate: string;
  payoffAmount: string | number | null;
  payoffQuotedAt: string | null;
  /** Quanto o bem vale hoje (FIPE/avaliação). */
  assetValue: string | number | null;
  assetValueAt: string | null;
  /** Foto do bem como data URL, já redimensionada — null quando nunca foi enviada. */
  photo: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  installments: FinancingInstallment[];
  equity: FinancingEquity;
}

export interface FinancingSummary {
  totalActive: number;
  committedThisMonth: number;
  totalRemaining: number;
  totalPaid: number;
  nextInstallment: { financingId: string; financingName: string; dueDate: string; amount: number } | null;
  equity: {
    assetsValue: number;
    debt: number;
    equity: number;
    /** Quantos financiamentos ativos ainda estão sem valor do bem — o total está incompleto. */
    withoutAssetValue: number;
  };
}
