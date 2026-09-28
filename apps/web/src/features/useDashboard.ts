import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { DashboardSummary } from "@/types";

export interface SpendingEvolutionPoint {
  year: number;
  month: number;
  total: number;
}

export interface CategoryBreakdown {
  name: string;
  color: string;
  total: number;
}

export interface StatisticsOverview {
  totalPaid: number;
  totalRemaining: number;
  remainingByCard: { cardId: string; cardName: string; color: string; remaining: number }[];
  biggestPurchase: { name: string; totalAmount: number; card: { name: string } } | null;
  topCategory: { name: string; total: number } | null;
  monthlyAverage: number;
  annualSpending: number;
  installmentTotal: number;
  cashTotal: number;
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => api.get<DashboardSummary>("/dashboard/summary"),
    refetchInterval: 60_000,
  });
}

export function useSpendingEvolution() {
  return useQuery({
    queryKey: ["dashboard", "evolution"],
    queryFn: () => api.get<SpendingEvolutionPoint[]>("/dashboard/spending-evolution"),
  });
}

export function useSpendingByCategory() {
  return useQuery({
    queryKey: ["dashboard", "by-category"],
    queryFn: () => api.get<CategoryBreakdown[]>("/dashboard/by-category"),
  });
}

export function useStatistics() {
  return useQuery({
    queryKey: ["statistics"],
    queryFn: () => api.get<StatisticsOverview>("/statistics"),
  });
}
