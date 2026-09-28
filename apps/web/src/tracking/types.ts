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
  /** Datas específicas de folga ("YYYY-MM-DD"), além do padrão semanal em weekdays. */
  daysOff: string[];
  /** Serviço com sistema de colocação: ao encerrar a sessão, o app pergunta o resultado do dia. */
  tracksPlacement: boolean;
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
  /** Colocação do dia. Nulo é "não informado" — nunca zero, que é valor legítimo em minutos. */
  placement: number | null;
  satisfactionPercent: number | null;
  responseMinutes: number | null;
  tracksPlacement: boolean;
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
  placement: number | null;
  satisfactionPercent: number | null;
  responseMinutes: number | null;
}

export interface TrackingCalendarDay {
  date: string;
  hours: number;
  revenue: number;
  sessions: TrackingCalendarDaySession[];
  /** Nomes dos trabalhos com folga marcada nesse dia. */
  daysOff: string[];
  /** A melhor (menor) colocação do dia — o que cabe na célula do mês. */
  bestPlacement: number | null;
}

/** Os três números do dia, do jeito que o gráfico lê. */
export interface PlacementPoint {
  date: string;
  placement: number | null;
  satisfactionPercent: number | null;
  responseMinutes: number | null;
}

export interface PlacementMetricSummary {
  best: number;
  average: number;
  days: number;
  /** Positivo = melhorou, já respeitando a direção da métrica. */
  trend: number | null;
}

export interface PlacementJob {
  jobId: string;
  jobName: string;
  color: string;
  points: PlacementPoint[];
  summary: {
    placement: PlacementMetricSummary | null;
    satisfaction: PlacementMetricSummary | null;
    responseMinutes: PlacementMetricSummary | null;
    daysWithData: number;
  };
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

// ---------------------------------------------------------------------------
// Extrato
// ---------------------------------------------------------------------------

export type StatementLang = "PT" | "EN";
/** PERSONAL vê tudo; COMPANY nunca vê dinheiro — e o corte é feito no servidor. */
export type StatementAudience = "PERSONAL" | "COMPANY";

export interface StatementSession {
  date: string;
  checkIn: string;
  checkOut: string | null;
  netSeconds: number;
  /** Sempre 0 na versão da empresa. */
  value: number;
  notes: string | null;
  notesTranslated?: string | null;
  placement: number | null;
  satisfactionPercent: number | null;
  responseMinutes: number | null;
}

export interface StatementMetric {
  best: number;
  average: number;
  days: number;
}

export interface TrackingStatement {
  job: { id: string; name: string; company: string; client: string | null; type: TrackingJobType; tracksPlacement: boolean };
  period: { from: string; to: string };
  lang: StatementLang;
  audience: StatementAudience;
  translation: { requested: boolean; available: boolean; applied: boolean };
  generatedAt: string;
  totals: {
    netSeconds: number;
    hours: number;
    daysWorked: number;
    sessions: number;
    averageHoursPerWorkedDay: number;
    /** `null` na versão da empresa — é assim que a tela sabe que não deve mostrar. */
    totalValue: number | null;
    averageHourlyRate: number | null;
  };
  byDay: { date: string; hours: number; sessions: number }[];
  placement: {
    placement: StatementMetric | null;
    satisfaction: StatementMetric | null;
    responseMinutes: StatementMetric | null;
    points: { date: string; placement: number | null; satisfactionPercent: number | null; responseMinutes: number | null }[];
  } | null;
  sessions: StatementSession[];
}
