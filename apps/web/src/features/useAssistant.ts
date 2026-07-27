import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function useAssistantChat() {
  return useMutation({
    mutationFn: (messages: ChatMessage[]) => api.post<{ messages: ChatMessage[] }>("/assistant/chat", { messages }),
  });
}
