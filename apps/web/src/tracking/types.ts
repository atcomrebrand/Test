export type TrackingSessionStatus = "RUNNING" | "PAUSED" | "COMPLETED";
export type TrackingJobType = "FIXO" | "FREELANCE";
export type TrackingIncomeCategory = "DIVIDENDO" | "VENDA" | "BONIFICACAO" | "CASHBACK" | "REEMBOLSO" | "PRESENTE" | "OUTRO";
export type TrackingCurrency = "BRL" | "USD";

export interface TrackingJob {
  id: string;
  type: TrackingJobType;
  name: string;
  company: string;
  client: string | null;
  /** Só existe quando type = FIXO. */
  monthlyValue: string | null;
  /** Só existe quando type = FREELANCE — valor total combinado pelo projeto inteiro. */
  totalAgreedValue: string | null;
  currency: TrackingCurrency;
  expectedHoursPerDay: number;
  startDate: string;
  endDate: string | null;
  paymentMethod: string | null;
  paymentDay: number | null;
  color: string;
  weekdays: number[];
  /** "HH:mm", opcional — dispara o lembrete "hora de iniciar" nesse horário, nos weekdays. */
  expectedStartTime: string | null;
  /** "HH:mm", opcional — dispara o lembrete "hora de encerrar" nesse horário exato; quando null,
   *  o lembrete usa expectedHoursPerDay em vez de um horário fixo. */
  expectedEndTime: string | null;
  notes: string | null;
  active: boolean;
  estimatedHourlyRate?: number | null;
  /** monthlyValue já convertido pra BRL (= monthlyValue quando currency é BRL). Só p/ FIXO. */
  monthlyValueBRL?: number | null;
  /** totalAgreedValue já convertido pra BRL. Só p/ FREELANCE. */
  totalAgreedValueBRL?: number | null;
  /** Cotação USD->BRL de hoje usada na conversão — null quando currency é BRL. */
  fxRate?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrackingPendingJobPayment {
  jobId: string;
  jobName: string;
  company: string;
  currency: TrackingCurrency;
  /** Só um ponto de partida pro campo (sempre editável) — o valor confirmado é sempre em reais. */
  suggestedAmountBRL: number | null;
  referenceYear: number;
  referenceMonth: number;
}

export interface TrackingJobPayment {
  id: string;
  jobId: string;
  jobName: string;
  referenceYear: number;
  referenceMonth: number;
  amount: string;
  currency: TrackingCurrency;
  exchangeRate: string | null;
  amountBRL: string;
  confirmedAt: string;
}

export interface TrackingSessionPause {
  id: string;
  sessionId: string;
  pausedAt: string;
  resumedAt: string | null;
}

export interface TrackingSession {
  id: string;
  userId: string;
  jobId: string;
  checkIn: string;
  checkOut: string | null;
  status: TrackingSessionStatus;
  notes: string | null;
  pauses: TrackingSessionPause[];
  job: TrackingJob;
  grossSeconds: number;
  pauseSeconds: number;
  netSeconds: number;
  hourlyRate: number;
  equivalentValue: number;
  isLongRunning: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrackingIncome {
  id: string;
  name: string;
  category: TrackingIncomeCategory;
  amount: string;
  date: string;
  notes: string | null;
  createdAt: string;
}

export interface TrackingDashboardSummary {
  hoursToday: number;
  hoursThisMonth: number;
  fixedJobsRevenue: number;
  freelanceRevenue: number;
  otherIncome: number;
  totalRevenue: number;
  averageHourlyRate: number | null;
  averageDailyHours: number | null;
  daysWorked: number;
  daysWithoutWork: number;
  nextPayment: { jobName: string; company: string; date: string; estimatedAmount: number } | null;
  previousMonth: {
    hoursThisMonth: number;
    totalRevenue: number;
  };
  financialGrowthPercent: number | null;
  productivityGrowthPercent: number | null;
  hoursByDay: { date: string; hours: number }[];
  revenueByCategory: { category: string; label: string; amount: number }[];
  revenueByClient: { client: string; amount: number }[];
  insights: string[];
}

export interface TrackingCalendarDaySession {
  jobName: string;
  company: string;
  checkIn: string;
  checkOut: string | null;
  netSeconds: number;
  value: number;
  notes: string | null;
}

export interface TrackingCalendarDay {
  date: string;
  hours: number;
  revenue: number;
  sessions: TrackingCalendarDaySession[];
}

export type ReportPeriod = "hoje" | "semana" | "mes" | "ano" | "personalizado";

export interface TrackingReportSummary {
  totalRevenue: number;
  hoursWorked: number;
  averageHourlyRate: number | null;
  projectsCount: number;
  otherIncomeTotal: number;
  daysWorked: number;
  maxDailyRevenue: number;
  maxDailyHours: number;
  averageDailyHours: number | null;
  revenueByCategory: { category: string; label: string; amount: number }[];
  revenueByClient: { client: string; amount: number }[];
  revenueByCompany: { company: string; amount: number }[];
}

export interface TrackingStatsSummary {
  totalHoursAllTime: number;
  totalRevenueAllTime: number;
  averageHourlyRateAllTime: number | null;
  bestMonth: { month: string; amount: number } | null;
  worstMonth: { month: string; amount: number } | null;
  biggestProject: { name: string; amount: number } | null;
  biggestOtherIncome: { name: string; amount: number } | null;
  checkInsCount: number;
  averageDailyHours: number | null;
  longestStreak: number;
  clientRanking: { name: string; amount: number }[];
  companyRanking: { name: string; amount: number }[];
  projectRanking: { name: string; amount: number }[];
  averageStartHour: number | null;
  averageEndHour: number | null;
  productivityByWeek: { period: string; hours: number }[];
  productivityByMonth: { period: string; hours: number }[];
}

export interface TrackingHistoryItem {
  id: string;
  entity: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

export interface TrackingHistoryResponse {
  items: TrackingHistoryItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface TrackingSearchResult {
  type: "SESSION" | "INCOME";
  id: string;
  label: string;
  sublabel: string;
  amount: number;
  date: string;
}
