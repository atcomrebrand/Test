import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import {
  ReportPeriod,
  TrackingCalendarDay,
  TrackingDashboardSummary,
  TrackingHistoryResponse,
  TrackingIncome,
  TrackingJob,
  TrackingProject,
  TrackingReportSummary,
  TrackingSearchResult,
  TrackingSession,
  TrackingStatsSummary,
} from "./types";

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["tracking"] });
}

// ---------------------------------------------------------------------------
// Trabalhos Fixos
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
      toast.success("Trabalho fixo cadastrado!");
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
      toast.success("Trabalho fixo atualizado!");
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
      toast.success("Trabalho fixo removido.");
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
    mutationFn: (data: { jobId: string; notes?: string }) => api.post<TrackingSession>("/tracking/sessions/start", data),
    onSuccess: () => invalidateAll(qc),
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
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => api.post<TrackingSession>(`/tracking/sessions/${id}/finish`, { notes }),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Sessão salva!");
    },
    onError: (e: Error) => toast.error(e.message),
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
// Projetos Extras
// ---------------------------------------------------------------------------

export function useTrackingProjects() {
  return useQuery({
    queryKey: ["tracking", "projects"],
    queryFn: () => api.get<TrackingProject[]>("/tracking/projects"),
  });
}

export function useCreateTrackingProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<TrackingProject>("/tracking/projects", data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Projeto cadastrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTrackingProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch<TrackingProject>(`/tracking/projects/${id}`, data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Projeto atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTrackingProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/tracking/projects/${id}`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Projeto removido.");
    },
    onError: (e: Error) => toast.error(e.message),
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
