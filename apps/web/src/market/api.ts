import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import {
  MarketProduct,
  MarketProductDetail,
  MarketPurchaseDetail,
  MarketPurchaseSummary,
  NotaItem,
  NotaPreview,
  SpendingSummary,
} from "./types";

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["market"] });
}

export interface CommitNotaPayload {
  storeName: string;
  storeCnpj?: string;
  accessKey?: string;
  purchaseDate: string;
  totalAmount: number;
  taxAmount?: number;
  notes?: string;
  items: NotaItem[];
}

/** Reads the nota off SEFAZ. A mutation rather than a query because it's an outbound call to a
 *  government portal that the user triggers deliberately — nothing should re-run it on a refocus
 *  or a retry. */
export function useScanNota() {
  return useMutation({
    mutationFn: (code: string) => api.post<NotaPreview>("/market/notas/scan", { code }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCommitNota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CommitNotaPayload) => api.post<MarketPurchaseDetail>("/market/notas/commit", payload),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Compra importada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMarketPurchases(range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ["market", "purchases", range?.from ?? null, range?.to ?? null],
    queryFn: () => api.get<MarketPurchaseSummary[]>("/market/purchases", { params: range }),
  });
}

export function useMarketPurchase(id: string | undefined) {
  return useQuery({
    queryKey: ["market", "purchase", id],
    queryFn: () => api.get<MarketPurchaseDetail>(`/market/purchases/${id}`),
    enabled: Boolean(id),
  });
}

export function useDeleteMarketPurchase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/market/purchases/${id}`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Compra removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMarketProducts() {
  return useQuery({
    queryKey: ["market", "products"],
    queryFn: () => api.get<MarketProduct[]>("/market/products"),
  });
}

export function useMarketProduct(id: string | undefined) {
  return useQuery({
    queryKey: ["market", "product", id],
    queryFn: () => api.get<MarketProductDetail>(`/market/products/${id}`),
    enabled: Boolean(id),
  });
}

export function useMarketSummary(range?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ["market", "summary", range?.from ?? null, range?.to ?? null],
    queryFn: () => api.get<SpendingSummary>("/market/summary", { params: range }),
  });
}
