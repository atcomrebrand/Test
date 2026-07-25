import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import {
  HouseholdBill,
  HouseholdBillCategory,
  HouseholdBillEntry,
  HouseholdCard,
  HouseholdCardEntry,
  HouseholdDashboardSummary,
  HouseholdIncome,
  HouseholdIncomeCategory,
} from "./types";

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["household"] });
}

// ---------------------------------------------------------------------------
// Categorias de contas
// ---------------------------------------------------------------------------

export function useHouseholdBillCategories() {
  return useQuery({
    queryKey: ["household", "bill-categories"],
    queryFn: () => api.get<HouseholdBillCategory[]>("/household/bill-categories"),
  });
}

export function useCreateHouseholdBillCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; icon?: string; color?: string }) =>
      api.post<HouseholdBillCategory>("/household/bill-categories", data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Categoria criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateHouseholdBillCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<HouseholdBillCategory>(`/household/bill-categories/${id}`, data),
    onSuccess: () => invalidateAll(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteHouseholdBillCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/household/bill-categories/${id}`),
    onSuccess: () => invalidateAll(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReorderHouseholdBillCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.patch("/household/bill-categories/reorder", { ids }),
    onSuccess: () => invalidateAll(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Categorias de entradas
// ---------------------------------------------------------------------------

export function useHouseholdIncomeCategories() {
  return useQuery({
    queryKey: ["household", "income-categories"],
    queryFn: () => api.get<HouseholdIncomeCategory[]>("/household/income-categories"),
  });
}

export function useCreateHouseholdIncomeCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; icon?: string; color?: string }) =>
      api.post<HouseholdIncomeCategory>("/household/income-categories", data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Categoria criada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateHouseholdIncomeCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<HouseholdIncomeCategory>(`/household/income-categories/${id}`, data),
    onSuccess: () => invalidateAll(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteHouseholdIncomeCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/household/income-categories/${id}`),
    onSuccess: () => invalidateAll(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useReorderHouseholdIncomeCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.patch("/household/income-categories/reorder", { ids }),
    onSuccess: () => invalidateAll(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Contas (Bills)
// ---------------------------------------------------------------------------

export function useHouseholdBills() {
  return useQuery({
    queryKey: ["household", "bills"],
    queryFn: () => api.get<HouseholdBill[]>("/household/bills"),
  });
}

export function useHouseholdBillsMonth(year: number, month: number) {
  return useQuery({
    queryKey: ["household", "bills", "month", year, month],
    queryFn: () => api.get<HouseholdBillEntry[]>(`/household/bills/month/${year}/${month}`),
  });
}

export function useCreateHouseholdBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<HouseholdBill>("/household/bills", data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Conta cadastrada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateHouseholdBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch<HouseholdBill>(`/household/bills/${id}`, data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Conta atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteHouseholdBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/household/bills/${id}`),
    onSuccess: () => invalidateAll(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateHouseholdBillEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { amount?: number; reservedAmount?: number; paidAmount?: number; skipped?: boolean; notes?: string };
    }) => api.patch<HouseholdBillEntry>(`/household/bills/entries/${id}`, data),
    onSuccess: () => invalidateAll(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Cartões de crédito
// ---------------------------------------------------------------------------

export function useHouseholdCards() {
  return useQuery({
    queryKey: ["household", "cards"],
    queryFn: () => api.get<HouseholdCard[]>("/household/cards"),
  });
}

export function useHouseholdCardsMonth(year: number, month: number) {
  return useQuery({
    queryKey: ["household", "cards", "month", year, month],
    queryFn: () => api.get<HouseholdCardEntry[]>(`/household/cards/month/${year}/${month}`),
  });
}

export function useCreateHouseholdCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<HouseholdCard>("/household/cards", data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Cartão cadastrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateHouseholdCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch<HouseholdCard>(`/household/cards/${id}`, data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Cartão atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteHouseholdCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/household/cards/${id}`),
    onSuccess: () => invalidateAll(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateHouseholdCardEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { totalInvoice?: number; provisioned?: number; paid?: boolean; notes?: string };
    }) => api.patch<HouseholdCardEntry>(`/household/cards/entries/${id}`, data),
    onSuccess: () => invalidateAll(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------------

export function useHouseholdIncomesMonth(year: number, month: number) {
  return useQuery({
    queryKey: ["household", "incomes", "month", year, month],
    queryFn: () => api.get<HouseholdIncome[]>(`/household/incomes/month/${year}/${month}`),
  });
}

export function useCreateHouseholdIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<HouseholdIncome>("/household/incomes", data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Entrada registrada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateHouseholdIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<HouseholdIncome>(`/household/incomes/${id}`, data),
    onSuccess: () => invalidateAll(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteHouseholdIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/household/incomes/${id}`),
    onSuccess: () => invalidateAll(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function useHouseholdDashboard(year: number, month: number) {
  return useQuery({
    queryKey: ["household", "dashboard", year, month],
    queryFn: () => api.get<HouseholdDashboardSummary>(`/household/dashboard/${year}/${month}`),
  });
}
