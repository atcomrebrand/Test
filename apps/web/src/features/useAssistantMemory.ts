import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface AssistantMemory {
  id: string;
  content: string;
  createdAt: string;
}

export function useAssistantMemories() {
  return useQuery({
    queryKey: ["assistant", "memories"],
    queryFn: () => api.get<AssistantMemory[]>("/assistant/memories"),
  });
}

export function useCreateAssistantMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.post<AssistantMemory>("/assistant/memories", { content }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assistant", "memories"] }),
  });
}

export function useDeleteAssistantMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/assistant/memories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assistant", "memories"] }),
  });
}
