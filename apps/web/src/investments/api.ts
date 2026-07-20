import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { CashAccount, DashboardSummary, InvestmentAsset, InvestmentFixedIncome } from "./types";

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["investments"] });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function useInvestmentsDashboard() {
  return useQuery({
    queryKey: ["investments", "dashboard"],
    queryFn: () => api.get<DashboardSummary>("/investments/dashboard/summary"),
  });
}

export interface InvestmentHistoryPage {
  items: { id: string; entity: string; action: string; changes: unknown; createdAt: string }[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export function useInvestmentHistory(page: number) {
  return useQuery({
    queryKey: ["investments", "history", page],
    queryFn: () => api.get<InvestmentHistoryPage>("/investments/dashboard/history", { params: { page, pageSize: 20 } }),
  });
}

// ---------------------------------------------------------------------------
// Assets (Ações / FIIs / Criptomoedas)
// ---------------------------------------------------------------------------

export function useAssets(assetClass?: string) {
  return useQuery({
    queryKey: ["investments", "assets", assetClass ?? "all"],
    queryFn: () => api.get<InvestmentAsset[]>("/investments/assets", { params: assetClass ? { class: assetClass } : undefined }),
  });
}

export function useAsset(id: string | null) {
  return useQuery({
    queryKey: ["investments", "assets", "detail", id],
    queryFn: () => api.get<InvestmentAsset>(`/investments/assets/${id}`),
    enabled: !!id,
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<InvestmentAsset>("/investments/assets", data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Ativo cadastrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/investments/assets/${id}`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Ativo removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, data }: { assetId: string; data: Record<string, unknown> }) =>
      api.post(`/investments/assets/${assetId}/transactions`, data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Lançamento registrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddAssetIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, data }: { assetId: string; data: Record<string, unknown> }) =>
      api.post(`/investments/assets/${assetId}/income`, data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Provento registrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Renda Fixa
// ---------------------------------------------------------------------------

export function useFixedIncomes() {
  return useQuery({
    queryKey: ["investments", "fixed-incomes"],
    queryFn: () => api.get<InvestmentFixedIncome[]>("/investments/fixed-incomes"),
  });
}

export function useFixedIncome(id: string | null) {
  return useQuery({
    queryKey: ["investments", "fixed-incomes", "detail", id],
    queryFn: () => api.get<InvestmentFixedIncome>(`/investments/fixed-incomes/${id}`),
    enabled: !!id,
  });
}

export function useCreateFixedIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<InvestmentFixedIncome>("/investments/fixed-incomes", data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Aplicação cadastrada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteFixedIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/investments/fixed-incomes/${id}`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Aplicação removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRedeemFixedIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<InvestmentFixedIncome>(`/investments/fixed-incomes/${id}/redeem`, {}),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Resgate registrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddFixedIncomeInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.post(`/investments/fixed-incomes/${id}/interest`, data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Juros registrados!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Caixa / Contas bancárias
// ---------------------------------------------------------------------------

export function useCashAccounts() {
  return useQuery({
    queryKey: ["investments", "cash-accounts"],
    queryFn: () => api.get<CashAccount[]>("/investments/cash-accounts"),
  });
}

export function useCreateCashAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/investments/cash-accounts", data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Conta cadastrada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCashAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/investments/cash-accounts/${id}`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Conta removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
