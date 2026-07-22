import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface QuoteTickerItem {
  symbol: string;
  label: string;
  flag: string;
  rate: number | null;
}

/** Cotação já vem cacheada no servidor (30min de TTL), então um refetch a cada poucos minutos no
 *  cliente é só pra pegar uma atualização eventual — nunca bate na fonte externa a cada render. */
const REFETCH_MS = 5 * 60 * 1000;

export function useQuotesTicker() {
  return useQuery({
    queryKey: ["quotes", "ticker"],
    queryFn: () => api.get<QuoteTickerItem[]>("/quotes/ticker"),
    refetchInterval: REFETCH_MS,
  });
}
