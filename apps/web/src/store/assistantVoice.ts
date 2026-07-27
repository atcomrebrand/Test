import { create } from "zustand";

interface AssistantVoiceState {
  voiceEnabled: boolean;
  voiceURI: string | null;
  toggleVoice: () => void;
  setVoiceURI: (voiceURI: string | null) => void;
}

const ENABLED_KEY = "cc_assistant_voice";
const VOICE_URI_KEY = "cc_assistant_voice_uri";

function getInitialEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === "1";
}

/** Whether the assistant reads its replies aloud (speechSynthesis) — off by default, since
 *  unsolicited audio on every reply would be surprising. Also holds which of the browser/OS's
 *  installed voices to speak with (voiceURI, the stable identifier speechSynthesis gives each
 *  SpeechSynthesisVoice) — null means "let the browser pick its default". Both persisted so they
 *  survive reloads. */
export const useAssistantVoiceStore = create<AssistantVoiceState>((set, get) => ({
  voiceEnabled: getInitialEnabled(),
  voiceURI: localStorage.getItem(VOICE_URI_KEY),
  toggleVoice: () => {
    const next = !get().voiceEnabled;
    localStorage.setItem(ENABLED_KEY, next ? "1" : "0");
    set({ voiceEnabled: next });
  },
  setVoiceURI: (voiceURI) => {
    if (voiceURI) localStorage.setItem(VOICE_URI_KEY, voiceURI);
    else localStorage.removeItem(VOICE_URI_KEY);
    set({ voiceURI });
  },
}));
