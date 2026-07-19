import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Purchase, CreditCard } from "@/types";

export function useGlobalSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: () => api.get<{ purchases: Purchase[]; cards: CreditCard[] }>("/search", { params: { q: query } }),
    enabled: query.trim().length > 1,
  });
}
