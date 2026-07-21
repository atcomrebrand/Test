import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { TrackingJob, TrackingSession } from "./types";

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
