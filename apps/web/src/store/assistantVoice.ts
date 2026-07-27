import { create } from "zustand";

export type VoiceSource = "browser" | "elevenlabs";

interface AssistantVoiceState {
  voiceEnabled: boolean;
  voiceSource: VoiceSource;
  voiceURI: string | null;
  elevenLabsVoiceId: string | null;
  toggleVoice: () => void;
  setVoiceSource: (source: VoiceSource) => void;
  setVoiceURI: (voiceURI: string | null) => void;
  setElevenLabsVoiceId: (voiceId: string | null) => void;
}

const ENABLED_KEY = "cc_assistant_voice";
const SOURCE_KEY = "cc_assistant_voice_source";
const VOICE_URI_KEY = "cc_assistant_voice_uri";
const ELEVENLABS_VOICE_KEY = "cc_assistant_elevenlabs_voice";

function getInitialEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === "1";
}

function getInitialSource(): VoiceSource {
  return localStorage.getItem(SOURCE_KEY) === "elevenlabs" ? "elevenlabs" : "browser";
}

/** Whether the assistant reads its replies aloud — off by default, since unsolicited audio on
 *  every reply would be surprising. voiceSource picks between the free browser voices
 *  (speechSynthesis, voiceURI) and the paid ElevenLabs upgrade (elevenLabsVoiceId); only one of
 *  voiceURI/elevenLabsVoiceId is actually used at a time, whichever matches voiceSource — both are
 *  kept around so switching sources doesn't lose the other one's choice. All persisted. */
export const useAssistantVoiceStore = create<AssistantVoiceState>((set, get) => ({
  voiceEnabled: getInitialEnabled(),
  voiceSource: getInitialSource(),
  voiceURI: localStorage.getItem(VOICE_URI_KEY),
  elevenLabsVoiceId: localStorage.getItem(ELEVENLABS_VOICE_KEY),
  toggleVoice: () => {
    const next = !get().voiceEnabled;
    localStorage.setItem(ENABLED_KEY, next ? "1" : "0");
    set({ voiceEnabled: next });
  },
  setVoiceSource: (source) => {
    localStorage.setItem(SOURCE_KEY, source);
    set({ voiceSource: source });
  },
  setVoiceURI: (voiceURI) => {
    if (voiceURI) localStorage.setItem(VOICE_URI_KEY, voiceURI);
    else localStorage.removeItem(VOICE_URI_KEY);
    set({ voiceURI });
  },
  setElevenLabsVoiceId: (voiceId) => {
    if (voiceId) localStorage.setItem(ELEVENLABS_VOICE_KEY, voiceId);
    else localStorage.removeItem(ELEVENLABS_VOICE_KEY);
    set({ elevenLabsVoiceId: voiceId });
  },
}));
