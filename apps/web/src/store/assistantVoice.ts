import { create } from "zustand";

interface AssistantVoiceState {
  voiceEnabled: boolean;
  toggleVoice: () => void;
}

const STORAGE_KEY = "cc_assistant_voice";

function getInitial(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "1";
}

/** Whether the assistant reads its replies aloud (speechSynthesis) — off by default, since
 *  unsolicited audio on every reply would be surprising. Persisted so it survives reloads. */
export const useAssistantVoiceStore = create<AssistantVoiceState>((set, get) => ({
  voiceEnabled: getInitial(),
  toggleVoice: () => {
    const next = !get().voiceEnabled;
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    set({ voiceEnabled: next });
  },
}));
