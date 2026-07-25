export type HouseholdBillStatus = "PENDING" | "PARTIALLY_RESERVED" | "RESERVED" | "PAID" | "LATE" | "SKIPPED";

export interface HouseholdBillCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  order: number;
}

export interface HouseholdIncomeCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
  order: number;
}

export interface HouseholdBill {
  id: string;
  categoryId: string | null;
  category: HouseholdBillCategory | null;
  name: string;
  dueDay: number;
  defaultAmount: string;
  allowAmountChange: boolean;
  mandatory: boolean;
  active: boolean;
  order: number;
  notes: string | null;
}

export interface HouseholdBillEntry {
  id: string;
  billId: string;
  bill: HouseholdBill;
  referenceYear: number;
  referenceMonth: number;
  dueDate: string;
  amount: string;
  reservedAmount: string;
  paidAmount: string;
  paidAt: string | null;
  status: HouseholdBillStatus;
  skipped: boolean;
  notes: string | null;
}

export interface HouseholdCard {
  id: string;
  name: string;
  closingDay: number;
  dueDay: number;
  color: string;
  icon: string;
  active: boolean;
  order: number;
}

export interface HouseholdCardEntry {
  id: string;
  cardId: string;
  card: HouseholdCard;
  referenceYear: number;
  referenceMonth: number;
  totalInvoice: string;
  provisioned: string;
  /** Always totalInvoice - provisioned, computed server-side — never edit this directly. */
  realAmount: number;
  paid: boolean;
  paidAt: string | null;
  notes: string | null;
}

export interface HouseholdIncome {
  id: string;
  categoryId: string | null;
  category: HouseholdIncomeCategory | null;
  date: string;
  description: string | null;
  amount: string;
  isForeignCurrency: boolean;
  grossAmountForeign: string | null;
  exchangeRate: string | null;
  notes: string | null;
}

export interface HouseholdDashboardSummary {
  referenceYear: number;
  referenceMonth: number;
  totalIncome: number;
  totalBills: number;
  totalCards: number;
  totalCommitted: number;
  totalReserved: number;
  totalMandatory: number;
  totalOptional: number;
  totalPaid: number;
  totalPending: number;
  freeBalance: number;
  billsCount: number;
  billsPaidCount: number;
  billsResolvedCount: number;
  billsPendingCount: number;
  billsLateCount: number;
  billsSkippedCount: number;
  upcomingDue: { id: string; name: string; dueDate: string; amount: number }[];
  lateBills: { id: string; name: string; dueDate: string; amount: number }[];
  paidPct: number;
  reservedPct: number;
  incomeVsExpenses: { income: number; expenses: number };
  billsByCategory: { name: string; color: string; amount: number }[];
  paymentEvolution: { day: number; cumulativePaid: number }[];
  allPaid: boolean;
  foreignIncome: { count: number; totalGrossUsd: number; totalConvertedBrl: number; avgRate: number | null };
  presumedSalary: { applied: boolean; amount: number; isForeignCurrency: boolean; rateUsed: number | null };
  savingsRate: number | null;
  previousMonthComparison: { referenceYear: number; referenceMonth: number; totalCommitted: number; totalPaid: number; deltaCommittedPct: number | null };
}

export interface HouseholdPresumedSalary {
  id: string;
  isForeignCurrency: boolean;
  amountBRL: string | null;
  amountUsd: string | null;
}
