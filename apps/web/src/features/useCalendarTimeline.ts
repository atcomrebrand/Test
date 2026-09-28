import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Installment } from "@/types";

export interface CalendarMonthSummary {
  month: number;
  year: number;
  total: number;
  installmentsCount: number;
  purchasesCount: number;
  weight: "none" | "low" | "medium" | "high";
}

export interface TimelineGroup {
  year: number;
  month: number;
  total: number;
  items: {
    installmentId: string;
    purchaseId: string;
    name: string;
    merchant: string | null;
    category: { id: string; name: string; color: string } | null;
    card: { id: string; name: string };
    amount: number;
    number: number;
    installmentsCount: number;
    isCash: boolean;
    isRecurring: boolean;
    status: string;
  }[];
}

export function useCalendarYear(year: number) {
  return useQuery({
    queryKey: ["calendar", year],
    queryFn: () => api.get<CalendarMonthSummary[]>(`/calendar/${year}`),
  });
}

export function useCalendarMonth(year: number, month: number | null) {
  return useQuery({
    queryKey: ["calendar", year, month],
    queryFn: () => api.get<Installment[]>(`/calendar/${year}/${month}`),
    enabled: Boolean(month),
  });
}

export function useTimeline() {
  return useQuery({
    queryKey: ["timeline"],
    queryFn: () => api.get<TimelineGroup[]>("/timeline"),
  });
}
