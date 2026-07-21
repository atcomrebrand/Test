export type TrackingSessionStatus = "RUNNING" | "PAUSED" | "COMPLETED";
export type TrackingProjectStatus = "EM_ANDAMENTO" | "CONCLUIDO" | "CANCELADO";
export type TrackingIncomeCategory = "DIVIDENDO" | "VENDA" | "BONIFICACAO" | "CASHBACK" | "REEMBOLSO" | "PRESENTE" | "OUTRO";

export interface TrackingJob {
  id: string;
  name: string;
  company: string;
  client: string | null;
  monthlyValue: string;
  expectedHoursPerDay: number;
  startDate: string;
  endDate: string | null;
  paymentMethod: string | null;
  paymentDay: number | null;
  color: string;
  weekdays: number[];
  notes: string | null;
  active: boolean;
  estimatedHourlyRate?: number;
  createdAt: string;
  updatedAt: string;
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

export interface TrackingProject {
  id: string;
  name: string;
  client: string | null;
  amountReceived: string;
  date: string;
  hoursSpent: string;
  status: TrackingProjectStatus;
  notes: string | null;
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
