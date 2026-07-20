import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Pagination, Purchase } from "@/types";
import toast from "react-hot-toast";

export interface PurchaseFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  cardId?: string;
  categoryId?: string;
  year?: number;
  month?: number;
  minAmount?: number;
  maxAmount?: number;
  kind?: string;
  favorite?: boolean;
  trashed?: boolean;
}

export function usePurchases(filters: PurchaseFilters) {
  return useQuery({
    queryKey: ["purchases", filters],
    queryFn: () =>
      api.get<{ items: Purchase[]; pagination: Pagination }>(
        "/purchases",
        { params: filters },
      ),
    placeholderData: (prev) => prev,
  });
}

export function usePurchase(id: string | undefined) {
  return useQuery({
    queryKey: ["purchases", id],
    queryFn: () => api.get<Purchase>(`/purchases/${id}`),
    enabled: Boolean(id),
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["purchases"] });
  qc.invalidateQueries({ queryKey: ["installments"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  qc.invalidateQueries({ queryKey: ["statistics"] });
  qc.invalidateQueries({ queryKey: ["calendar"] });
  qc.invalidateQueries({ queryKey: ["timeline"] });
  qc.invalidateQueries({ queryKey: ["cards"] });
}

export function useCreatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/purchases", data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Compra lançada com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch(`/purchases/${id}`, data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Compra atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDuplicatePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/purchases/${id}/duplicate`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Compra duplicada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCancelRecurrence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/purchases/${id}/cancel-recurrence`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Assinatura cancelada. As cobranças futuras foram removidas.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useScheduleCancellation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, recurrenceEndDate }: { id: string; recurrenceEndDate: string }) =>
      api.patch(`/purchases/${id}/schedule-cancellation`, { recurrenceEndDate }),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Cancelamento planejado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTrashPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/purchases/${id}`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Compra movida para a lixeira.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRestorePurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/purchases/${id}/restore`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Compra restaurada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePurchaseForever() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/purchases/${id}/permanent`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Compra excluída permanentemente.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
