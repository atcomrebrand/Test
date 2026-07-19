import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { Financing, FinancingSummary } from "@/types";

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["financings"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
}

export function useFinancings() {
  return useQuery({
    queryKey: ["financings"],
    queryFn: () => api.get<Financing[]>("/financings"),
  });
}

export function useFinancingSummary() {
  return useQuery({
    queryKey: ["financings", "summary"],
    queryFn: () => api.get<FinancingSummary>("/financings/summary"),
  });
}

export function useCreateFinancing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/financings", data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Financiamento cadastrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateFinancing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch(`/financings/${id}`, data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Financiamento atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePayoff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payoffAmount, payoffQuotedAt }: { id: string; payoffAmount: number; payoffQuotedAt?: string }) =>
      api.patch(`/financings/${id}/payoff`, { payoffAmount, payoffQuotedAt }),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Valor de quitação atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteFinancing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/financings/${id}`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Financiamento excluído.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function usePayFinancingInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paidAmount }: { id: string; paidAmount?: number }) =>
      api.post(`/financings/installments/${id}/pay`, { paidAmount }),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Parcela marcada como paga!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnpayFinancingInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/financings/installments/${id}/unpay`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Pagamento revertido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateFinancingInstallmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "PENDING" | "LATE" | "CANCELLED" }) =>
      api.patch(`/financings/installments/${id}/status`, { status }),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Status atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
