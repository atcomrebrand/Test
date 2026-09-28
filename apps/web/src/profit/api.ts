import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import {
  ProfitChannel,
  ProfitFixedCost,
  ProfitProductDetail,
  ProfitProductSummary,
  ProfitSettings,
  ProfitSettingsInput,
  SimulationResult,
} from "./types";

/** Mexer em custo fixo, imposto ou canal muda TODO cálculo do módulo — o preço sugerido de cada
 *  produto em cada canal sai do mesmo contexto. Por isso a invalidação é da raiz, não da entidade. */
function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["profit"] });
}

export function useProfitSettings() {
  return useQuery({ queryKey: ["profit", "settings"], queryFn: () => api.get<ProfitSettings>("/profit/settings") });
}

export function useUpdateProfitSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProfitSettingsInput) => api.patch<ProfitSettings>("/profit/settings", data),
    onSuccess: () => invalidate(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useFixedCosts() {
  return useQuery({ queryKey: ["profit", "fixed-costs"], queryFn: () => api.get<ProfitFixedCost[]>("/profit/fixed-costs") });
}

export function useCreateFixedCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; amount: number }) => api.post<ProfitFixedCost>("/profit/fixed-costs", data),
    onSuccess: () => { invalidate(qc); toast.success("Custo fixo adicionado."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveFixedCost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/profit/fixed-costs/${id}`),
    onSuccess: () => invalidate(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useProfitChannels() {
  return useQuery({ queryKey: ["profit", "channels"], queryFn: () => api.get<ProfitChannel[]>("/profit/channels") });
}

export function useSaveChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? api.patch<ProfitChannel>(`/profit/channels/${id}`, data) : api.post<ProfitChannel>("/profit/channels", data),
    onSuccess: () => { invalidate(qc); toast.success("Canal salvo."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useArchiveChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/profit/channels/${id}`),
    onSuccess: () => { invalidate(qc); toast.success("Canal arquivado."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useProfitProducts() {
  return useQuery({ queryKey: ["profit", "products"], queryFn: () => api.get<ProfitProductSummary[]>("/profit/products") });
}

/** A meta entra na chave: "quantas vendas pra tirar 2.000" e "pra tirar 5.000" são respostas
 *  diferentes, e as duas valem cache. */
export function useProfitProduct(id: string | undefined, targetProfit: number) {
  return useQuery({
    queryKey: ["profit", "product", id, targetProfit],
    queryFn: () => api.get<ProfitProductDetail>(`/profit/products/${id}`, { params: { targetProfit } }),
    enabled: !!id,
  });
}

export function useSaveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: string; data: Record<string, unknown> }) =>
      id ? api.patch(`/profit/products/${id}`, data) : api.post("/profit/products", data),
    onSuccess: () => { invalidate(qc); toast.success("Produto salvo."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useArchiveProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/profit/products/${id}`),
    onSuccess: () => { invalidate(qc); toast.success("Produto arquivado."); },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetProductPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId,
      channelId,
      price,
      targetMarginPercent,
    }: {
      productId: string;
      channelId: string;
      price: number | null;
      /** A margem que você quer NESTE canal. Ausente = usa a padrão das configurações. */
      targetMarginPercent?: number | null;
    }) => api.post(`/profit/products/${productId}/price`, { channelId, price, targetMarginPercent }),
    onSuccess: () => invalidate(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** A calculadora avulsa. Nada é gravado, então ela é mutation e não query: é uma pergunta que a
 *  pessoa faz, não um estado que a tela observa. */
export function useSimulate() {
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<SimulationResult>("/profit/simulate", data),
    onError: (e: Error) => toast.error(e.message),
  });
}
