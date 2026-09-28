import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import {
  PlacementJob,
  PlacementPoint,
  StatementAudience,
  StatementLang,
  TrackingStatement,
  ReportPeriod,
  TrackingCalendarDay,
  TrackingDashboardSummary,
  TrackingHistoryResponse,
  TrackingIncome,
  TrackingJob,
  TrackingJobPayment,
  TrackingPendingJobPayment,
  TrackingReportSummary,
  TrackingSearchResult,
  TrackingSession,
  TrackingStatsSummary,
} from "./types";

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["tracking"] });
}

// ---------------------------------------------------------------------------
// Trabalhos (fixo ou freelance)
// ---------------------------------------------------------------------------

export function useTrackingJobs() {
  return useQuery({
    queryKey: ["tracking", "jobs"],
    queryFn: () => api.get<TrackingJob[]>("/tracking/jobs"),
  });
}

export function useCreateTrackingJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<TrackingJob>("/tracking/jobs", data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Trabalho cadastrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTrackingJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch<TrackingJob>(`/tracking/jobs/${id}`, data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Trabalho atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTrackingJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tracking/jobs/${id}`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Trabalho removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Confirmação mensal de pagamento
// ---------------------------------------------------------------------------

/** Mesma cadência do useActiveSession — pega o banner assim que o dia de pagamento chega, mesmo
 *  que o usuário já tenha a tela aberta desde antes da meia-noite. */
const PENDING_PAYMENTS_REFETCH_MS = 30_000;

export function usePendingJobPayments() {
  return useQuery({
    queryKey: ["tracking", "job-payments", "pending"],
    queryFn: () => api.get<TrackingPendingJobPayment[]>("/tracking/job-payments/pending"),
    refetchInterval: PENDING_PAYMENTS_REFETCH_MS,
  });
}

export function useConfirmJobPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, amount }: { jobId: string; amount: number }) =>
      api.post<TrackingJobPayment>(`/tracking/job-payments/${jobId}/confirm`, { amount }),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Pagamento confirmado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Sessões / cronômetro
// ---------------------------------------------------------------------------

/** Short poll so the floating bar / focus mode notice a session started on another device or tab. */
const ACTIVE_SESSION_REFETCH_MS = 30_000;

export function useActiveSession() {
  return useQuery({
    queryKey: ["tracking", "sessions", "active"],
    queryFn: () => api.get<TrackingSession | null>("/tracking/sessions/active"),
    refetchInterval: ACTIVE_SESSION_REFETCH_MS,
  });
}

export function useTrackingSessions(from?: string, to?: string) {
  return useQuery({
    queryKey: ["tracking", "sessions", from ?? null, to ?? null],
    queryFn: () => api.get<TrackingSession[]>("/tracking/sessions", { params: from && to ? { from, to } : undefined }),
  });
}

export function useStartSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { jobId: string; checkIn?: string; notes?: string }) => api.post<TrackingSession>("/tracking/sessions/start", data),
    onSuccess: () => invalidateAll(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** "Sessão retroativa" — registra um dia/horário que ficou de fora do cronômetro ao vivo. */
export function useCreateManualSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { jobId: string; checkIn: string; checkOut: string; notes?: string }) =>
      api.post<TrackingSession>("/tracking/sessions/manual", data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Sessão retroativa registrada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePauseSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<TrackingSession>(`/tracking/sessions/${id}/pause`, {}),
    onSuccess: () => invalidateAll(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResumeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<TrackingSession>(`/tracking/sessions/${id}/resume`, {}),
    onSuccess: () => invalidateAll(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useFinishSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes, ...placement }: { id: string; notes?: string } & Partial<PlacementPoint>) =>
      api.post<TrackingSession>(`/tracking/sessions/${id}/finish`, { notes, ...placement }),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Sessão salva!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** A evolução da colocação, por trabalho. A chave começa com "tracking", então o `invalidateAll`
 *  já a alcança — encerrar uma sessão atualiza o gráfico sem nada a mais. */
export function usePlacementEvolution() {
  return useQuery({
    queryKey: ["tracking", "placement", "evolution"],
    queryFn: () => api.get<PlacementJob[]>("/tracking/placement/evolution"),
  });
}

/**
 * O extrato de um trabalho num período.
 *
 * `enabled` guarda a consulta até haver trabalho escolhido: sem isso a tela dispararia uma
 * requisição inútil (e, em inglês, uma tradução paga) assim que abrisse.
 */
export function useTrackingStatement(params: {
  jobId: string | null;
  from: string;
  to: string;
  lang: StatementLang;
  audience: StatementAudience;
}) {
  return useQuery({
    queryKey: ["tracking", "statement", params],
    queryFn: () =>
      api.get<TrackingStatement>("/tracking/statement", {
        params: { jobId: params.jobId, from: params.from, to: params.to, lang: params.lang, audience: params.audience },
      }),
    enabled: !!params.jobId && !!params.from && !!params.to,
  });
}

export function useUpdateSessionManual() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch<TrackingSession>(`/tracking/sessions/${id}`, data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Sessão atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tracking/sessions/${id}`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Sessão removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function useTrackingDashboard() {
  return useQuery({
    queryKey: ["tracking", "dashboard"],
    queryFn: () => api.get<TrackingDashboardSummary>("/tracking/dashboard"),
  });
}

// ---------------------------------------------------------------------------
// Outras Entradas
// ---------------------------------------------------------------------------

export function useTrackingIncomes() {
  return useQuery({
    queryKey: ["tracking", "incomes"],
    queryFn: () => api.get<TrackingIncome[]>("/tracking/incomes"),
  });
}

export function useCreateTrackingIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<TrackingIncome>("/tracking/incomes", data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Entrada cadastrada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTrackingIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch<TrackingIncome>(`/tracking/incomes/${id}`, data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Entrada atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTrackingIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tracking/incomes/${id}`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Entrada removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Calendário
// ---------------------------------------------------------------------------

export function useTrackingCalendar(year: number, month: number) {
  return useQuery({
    queryKey: ["tracking", "calendar", year, month],
    queryFn: () => api.get<TrackingCalendarDay[]>("/tracking/calendar", { params: { year, month } }),
  });
}

// ---------------------------------------------------------------------------
// Relatórios
// ---------------------------------------------------------------------------

export function useTrackingReports(period: ReportPeriod, from?: string, to?: string) {
  return useQuery({
    queryKey: ["tracking", "reports", period, from ?? null, to ?? null],
    queryFn: () => api.get<TrackingReportSummary>("/tracking/reports", { params: { period, from, to } }),
  });
}

// ---------------------------------------------------------------------------
// Estatísticas
// ---------------------------------------------------------------------------

export function useTrackingStats() {
  return useQuery({
    queryKey: ["tracking", "stats"],
    queryFn: () => api.get<TrackingStatsSummary>("/tracking/stats"),
  });
}

// ---------------------------------------------------------------------------
// Histórico
// ---------------------------------------------------------------------------

export function useTrackingHistory(page: number) {
  return useQuery({
    queryKey: ["tracking", "history", page],
    queryFn: () => api.get<TrackingHistoryResponse>("/tracking/history", { params: { page } }),
  });
}

// ---------------------------------------------------------------------------
// Busca
// ---------------------------------------------------------------------------

export function useTrackingSearch(query: string) {
  return useQuery({
    queryKey: ["tracking", "search", query],
    queryFn: () => api.get<TrackingSearchResult[]>("/tracking/search", { params: { q: query } }),
    enabled: query.trim().length > 0,
  });
}
