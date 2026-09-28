import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { CreditCard } from "@/types";
import toast from "react-hot-toast";

export function useCards() {
  return useQuery({
    queryKey: ["cards"],
    queryFn: () => api.get<CreditCard[]>("/cards"),
  });
}

export function useCardUsage(cardId: string | undefined) {
  return useQuery({
    queryKey: ["cards", cardId, "usage"],
    queryFn: () => api.get(`/cards/${cardId}/usage`),
    enabled: Boolean(cardId),
  });
}

export function useCreateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<CreditCard>) => api.post("/cards", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      toast.success("Cartão adicionado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreditCard> }) => api.patch(`/cards/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      toast.success("Cartão atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/cards/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cards"] });
      toast.success("Cartão excluído.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
