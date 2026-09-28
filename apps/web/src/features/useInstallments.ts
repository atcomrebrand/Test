import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Installment, Pagination } from "@/types";
import toast from "react-hot-toast";

export interface InstallmentFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  cardId?: string;
  categoryId?: string;
  status?: string;
  year?: number;
  month?: number;
  minAmount?: number;
  maxAmount?: number;
}

export function useInstallments(filters: InstallmentFilters) {
  return useQuery({
    queryKey: ["installments", filters],
    queryFn: () =>
      api.get<{ items: Installment[]; pagination: Pagination }>(
        "/installments",
        { params: filters },
      ),
    placeholderData: (prev) => prev,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["installments"] });
  qc.invalidateQueries({ queryKey: ["purchases"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  qc.invalidateQueries({ queryKey: ["statistics"] });
  qc.invalidateQueries({ queryKey: ["calendar"] });
  qc.invalidateQueries({ queryKey: ["timeline"] });
  qc.invalidateQueries({ queryKey: ["notifications"] });
}

export function usePayInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amountPaid, method }: { id: string; amountPaid?: number; method?: string }) =>
      api.post(`/installments/${id}/pay`, { amountPaid, method }),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Parcela marcada como paga!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnpayInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/installments/${id}/unpay`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Pagamento revertido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateInstallmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "PENDING" | "LATE" | "CANCELLED" }) =>
      api.patch(`/installments/${id}/status`, { status }),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Status atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
