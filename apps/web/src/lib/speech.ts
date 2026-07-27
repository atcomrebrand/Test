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

export function speak(text: string, onEnd?: () => void): void {
  if (!isSpeechSynthesisSupported() || !text.trim()) {
    onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = LANG;
  if (onEnd) utterance.onend = onEnd;
  window.speechSynthesis.speak(utterance);
}

export function cancelSpeech(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
}
