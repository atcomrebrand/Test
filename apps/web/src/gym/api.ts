import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  GymExercise, GymExerciseDetail, GymHome, GymMeasurement, GymPhoto, GymPrefill, GymProfile,
  GymProgress, GymRecord, GymSessionDetail, GymSessionSummary, GymTarget, GymWorkout, ProgressRange,
} from "./types";

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["gym"] });
}

export function useGymHome(range: ProgressRange = "MONTH") {
  return useQuery({ queryKey: ["gym", "home", range], queryFn: () => api.get<GymHome>("/gym/home", { params: { range } }) });
}

export function useGymProfile() {
  return useQuery({ queryKey: ["gym", "profile"], queryFn: () => api.get<GymProfile>("/gym/profile") });
}

export function useUpdateGymProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<GymProfile> & { onboarded?: boolean }) => api.put<GymProfile>("/gym/profile", body),
    onSuccess: () => invalidate(qc),
  });
}

export interface ExerciseQuery {
  query?: string;
  muscle?: string | null;
  equipment?: string | null;
  favorites?: boolean;
}

export function useGymExercises(filters: ExerciseQuery = {}) {
  return useQuery({
    queryKey: ["gym", "exercises", filters],
    queryFn: () =>
      api.get<GymExercise[]>("/gym/exercises", {
        params: {
          query: filters.query || undefined,
          muscle: filters.muscle || undefined,
          equipment: filters.equipment || undefined,
          favorites: filters.favorites ? "true" : undefined,
        },
      }),
    staleTime: 60_000,
  });
}

export function useGymExercise(id: string | undefined) {
  return useQuery({
    queryKey: ["gym", "exercise", id],
    queryFn: () => api.get<GymExerciseDetail>(`/gym/exercises/${id}`),
    enabled: !!id,
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/gym/exercises/${id}/favorite`, {}),
    onSuccess: () => invalidate(qc),
  });
}

export function useGymWorkouts() {
  return useQuery({ queryKey: ["gym", "workouts"], queryFn: () => api.get<GymWorkout[]>("/gym/workouts") });
}

export function useGymWorkout(id: string | undefined) {
  return useQuery({
    queryKey: ["gym", "workout", id],
    queryFn: () => api.get<GymWorkout>(`/gym/workouts/${id}`),
    enabled: !!id,
  });
}

export function useCreateWorkout() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: unknown) => api.post<GymWorkout>("/gym/workouts", body), onSuccess: () => invalidate(qc) });
}

export function useUpdateWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => api.patch<GymWorkout>(`/gym/workouts/${id}`, body),
    onSuccess: () => invalidate(qc),
  });
}

export function useDuplicateWorkout() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.post<GymWorkout>(`/gym/workouts/${id}/duplicate`, {}), onSuccess: () => invalidate(qc) });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/gym/workouts/${id}`), onSuccess: () => invalidate(qc) });
}

export function useReorderWorkouts() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (ids: string[]) => api.patch("/gym/workouts/reorder", { ids }), onSuccess: () => invalidate(qc) });
}

/** Tudo que o modo treino precisa antes de começar — depois disso ele roda sem rede. */
export function useWorkoutPrefill(id: string | undefined) {
  return useQuery({
    queryKey: ["gym", "prefill", id],
    queryFn: () => api.get<GymPrefill>(`/gym/workouts/${id}/prefill`),
    enabled: !!id,
    staleTime: 0,
  });
}

export function useGymSessions(range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ["gym", "sessions", range?.from ?? null, range?.to ?? null],
    queryFn: () => api.get<GymSessionSummary[]>("/gym/sessions", { params: range }),
  });
}

export function useGymSession(id: string | undefined) {
  return useQuery({
    queryKey: ["gym", "session", id],
    queryFn: () => api.get<GymSessionDetail>(`/gym/sessions/${id}`),
    enabled: !!id,
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/gym/sessions/${id}`), onSuccess: () => invalidate(qc) });
}

export function useGymProgress(range: ProgressRange = "M3") {
  return useQuery({ queryKey: ["gym", "progress", range], queryFn: () => api.get<GymProgress>("/gym/progress", { params: { range } }) });
}

export function useGymRecords() {
  return useQuery({ queryKey: ["gym", "records"], queryFn: () => api.get<GymRecord[]>("/gym/records") });
}

export function useGymMeasurements() {
  return useQuery({ queryKey: ["gym", "measurements"], queryFn: () => api.get<GymMeasurement[]>("/gym/measurements") });
}

export function useSaveMeasurement() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: unknown) => api.post("/gym/measurements", body), onSuccess: () => invalidate(qc) });
}

export function useDeleteMeasurement() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/gym/measurements/${id}`), onSuccess: () => invalidate(qc) });
}

export function useGymPhotos() {
  return useQuery({ queryKey: ["gym", "photos"], queryFn: () => api.get<GymPhoto[]>("/gym/photos") });
}

export function useCreatePhoto() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: unknown) => api.post("/gym/photos", body), onSuccess: () => invalidate(qc) });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/gym/photos/${id}`), onSuccess: () => invalidate(qc) });
}

export function useGymTargets() {
  return useQuery({ queryKey: ["gym", "targets"], queryFn: () => api.get<GymTarget[]>("/gym/targets") });
}

export function useCreateTarget() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: unknown) => api.post("/gym/targets", body), onSuccess: () => invalidate(qc) });
}

export function useUpdateTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => api.patch(`/gym/targets/${id}`, body),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteTarget() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/gym/targets/${id}`), onSuccess: () => invalidate(qc) });
}
