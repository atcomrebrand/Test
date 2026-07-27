/**
 * Thin wrapper over the browser's Web Speech API (SpeechRecognition + speechSynthesis) — not in
 * TS's standard DOM lib since it's a de-facto (Chrome/WebKit) API, not a W3C standard, hence the
 * local interfaces below. No server involved: transcription and voice both run in the browser/OS.
 * iOS Safari has no SpeechRecognition support — isSpeechRecognitionSupported() is how callers
 * detect and degrade gracefully instead of throwing.
 */

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  results: SpeechRecognitionResultListLike;
  resultIndex: number;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}

export interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const LANG = "pt-BR";

export function isSpeechRecognitionSupported(): boolean {
  return typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function createSpeechRecognition(opts: { continuous?: boolean; interimResults?: boolean } = {}): SpeechRecognitionLike | null {
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = LANG;
  recognition.continuous = opts.continuous ?? false;
  recognition.interimResults = opts.interimResults ?? false;
  return recognition;
}

export interface RecognitionResult {
  transcript: string;
  isFinal: boolean;
}

/** Reads the most recently changed result out of a recognition event — works for both a
 *  single-shot (continuous: false) and a streaming (continuous: true) recognition session. */
export function extractLatestResult(event: SpeechRecognitionEventLike): RecognitionResult {
  const result = event.results[event.results.length - 1];
  return { transcript: result[0].transcript, isFinal: result.isFinal };
}

/** getVoices() can return [] on first call in some browsers until the async voiceschanged event
 *  fires — this waits for that (with a timeout fallback) so callers get a populated list instead
 *  of an empty one on a cold page load. */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isSpeechSynthesisSupported()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const existing = synth.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => resolve(synth.getVoices()), 1000);
    synth.onvoiceschanged = () => {
      clearTimeout(timeoutId);
      resolve(synth.getVoices());
    };
  });
}

/** Prefers pt-* voices (what most people here will want) but falls back to everything installed
 *  rather than an empty picker if the device has no Portuguese voice at all. Also puts
 *  `localService: false` ("network") voices first — those are rendered server-side by the
 *  browser vendor (still free to us) and consistently sound far less robotic than the on-device
 *  ones, which is the whole free lever available here without switching to a paid TTS API. */
export function getPreferredVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const pt = voices.filter((v) => v.lang.toLowerCase().startsWith("pt"));
  const pool = pt.length > 0 ? pt : voices;
  return [...pool].sort((a, b) => Number(a.localService) - Number(b.localService));
}

/** Speaks a near-silent utterance synchronously inside a user-gesture handler (a click, not an
 *  async callback) — some browsers only grant speechSynthesis permission within an active user
 *  gesture, and by the time a reply comes back from the API that gesture has long expired. This
 *  "unlocks" the engine for the async speak() calls that follow later in the same session, the
 *  same trick used to unlock <audio>/Web Audio on iOS Safari. */
export function primeSpeechSynthesis(): void {
  if (!isSpeechSynthesisSupported()) return;
  const utterance = new SpeechSynthesisUtterance(" ");
  utterance.volume = 0;
  window.speechSynthesis.speak(utterance);
}

/** Max time to wait for the utterance to actually start/end before giving up and calling onEnd
 *  anyway — covers the case where speak() silently never fires any event at all (missing TTS
 *  voice data, engine not installed), which would otherwise hang a caller like the call-mode loop
 *  forever in a "falando" state with no way out except hanging up. */
const SPEAK_TIMEOUT_MS = 15_000;

export function speak(text: string, onEnd?: () => void, voiceURI?: string | null): void {
  if (!isSpeechSynthesisSupported() || !text.trim()) {
    onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutId);
    onEnd?.();
  };
  const timeoutId = window.setTimeout(finish, SPEAK_TIMEOUT_MS);

  const doSpeak = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANG;
    if (voiceURI) {
      const voice = synth.getVoices().find((v) => v.voiceURI === voiceURI);
      if (voice) utterance.voice = voice;
    }
    utterance.onend = finish;
    utterance.onerror = finish;
    synth.speak(utterance);
  };

  // Chrome has a known bug where speak() called immediately after cancel() silently drops the
  // utterance — only cancel (and wait a beat) when something is actually queued/speaking.
  if (synth.speaking || synth.pending) {
    synth.cancel();
    setTimeout(doSpeak, 50);
  } else {
    doSpeak();
  }
}

export function cancelSpeech(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}
