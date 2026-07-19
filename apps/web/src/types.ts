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
  lateInstallmentsCount: number;
  recentPurchases: Purchase[];
  nextClosing: { cardId: string; cardName: string; date: string } | null;
  nextDue: { cardId: string; cardName: string; date: string } | null;
  limitUsage: { totalLimit: number; totalSpent: number; usagePct: number };
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
  alertUpcomingDue: boolean;
  alertLimitWarning: boolean;
  alertLateInstall: boolean;
  alertSpendingJump: boolean;
  limitWarningPct: number;
  dashboardWidgets: string[];
}
