import { useMutation, useQuery } from "@tanstack/react-query";
import { api, getToken } from "@/lib/api";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function useAssistantChat() {
  return useMutation({
    mutationFn: (messages: ChatMessage[]) => api.post<{ messages: ChatMessage[] }>("/assistant/chat", { messages }),
  });
}

export interface ElevenLabsVoice {
  voiceId: string;
  name: string;
  previewUrl: string | null;
}

/** retry: false + a short staleTime — this 503s whenever ELEVENLABS_API_KEY isn't set on the
 *  server, which is the expected default state, not a transient failure worth retrying. */
export function useElevenLabsVoices(enabled = true) {
  return useQuery({
    queryKey: ["assistant", "elevenlabs-voices"],
    queryFn: () => api.get<ElevenLabsVoice[]>("/assistant/voices"),
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333/api/v1";

/**
 * Bypasses the shared axios client on purpose: the response is binary audio, not the {success,
 * data} JSON envelope every other endpoint returns, and on error we still want the real backend
 * message (e.g. "sem créditos no ElevenLabs") instead of the generic fallback the shared
 * interceptor would produce for a non-JSON body.
 */
export async function synthesizeSpeech(text: string, voiceId: string): Promise<Blob> {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}/assistant/speak`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text, voiceId }),
  });

  if (!res.ok) {
    let message = "Erro ao gerar áudio.";
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      // keep the generic message if the error body isn't JSON
    }
    throw new Error(message);
  }

  return res.blob();
}
