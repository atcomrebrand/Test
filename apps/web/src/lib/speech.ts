/**
 * Thin wrapper over the browser's Web Speech API (SpeechRecognition + speechSynthesis) — not in
 * TS's standard DOM lib since it's a de-facto (Chrome/WebKit) API, not a W3C standard, hence the
 * local interfaces below. No server involved: transcription and voice both run in the browser/OS.
 * iOS Safari (and any "Chrome"/other browser on iOS — Apple requires them all to run on WebKit)
 * has supported webkitSpeechRecognition since 14.5, but WebKit's autoplay/media-unlock rules are
 * much stricter than Chrome's — see primeAudioPlayback() below. isSpeechRecognitionSupported() is
 * how callers detect the (rarer, but real) browsers with no support at all and degrade gracefully.
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
  // Not 0 — WebKit's autoplay-unlock heuristic can treat a fully muted (volume: 0) playback as
  // never having needed permission in the first place, so it may not count as proof of a genuine
  // user gesture for the *next* (real, audible) speak() call. Low but non-zero still counts.
  utterance.volume = 0.01;
  window.speechSynthesis.speak(utterance);
}

/** Max time to wait for the utterance to actually start/end before giving up and calling onEnd
 *  anyway — covers the case where speak() silently never fires any event at all (missing TTS
 *  voice data, engine not installed), which would otherwise hang a caller like the call-mode loop
 *  forever in a "falando" state with no way out except hanging up. */
const SPEAK_TIMEOUT_MS = 15_000;

/** Rough Portuguese speech rate used to estimate how long an utterance will take to read aloud —
 *  there's no way to know the real duration in advance for speechSynthesis (unlike decoded
 *  ElevenLabs audio, which reports its own exact duration), so callers that want to reveal a
 *  caption in sync with speech (a typewriter effect) use this estimate to pace it. */
const CHARS_PER_SECOND = 14;

export function estimateSpeechDurationMs(text: string): number {
  return (text.length / CHARS_PER_SECOND) * 1000;
}

/** onStart fires once speech genuinely begins (or after a short grace period if the browser never
 *  fires its own "start" event) with an estimated duration in ms — callers use it to sync a
 *  caption reveal to roughly when audio is actually audible, not to whenever speak() was called
 *  (which can be well before anything comes out of the speakers). */
export function speak(text: string, onEnd?: () => void, voiceURI?: string | null, onStart?: (estimatedDurationMs: number) => void): void {
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
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      onStart?.(estimateSpeechDurationMs(text));
    };
    // Not every engine reliably fires onstart (notably some WebKit versions) — a short grace
    // period guarantees the caption still reveals instead of staying blank for the whole reply.
    const startFallbackId = window.setTimeout(start, 300);
    utterance.onstart = () => {
      clearTimeout(startFallbackId);
      start();
    };
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

/**
 * Plays ElevenLabs-generated audio via the Web Audio API instead of an <audio> element. iOS
 * Safari/WebKit (incl. "Chrome" on iOS — same engine underneath) has real, documented reliability
 * problems playing dynamically-fetched audio through <audio src> once it's more than ~70KB either
 * via a `blob:` URL (broken since iOS 15.4) or a `data:` URI (never reliably supported for audio
 * on mobile Safari at all) — a short spoken reply crosses that size easily. decodeAudioData() is
 * the documented-stable path around both. Uses the legacy 3-argument callback form (not the
 * Promise-returning overload) since that's the one every WebKit version has supported.
 */
type AudioContextConstructor = new () => AudioContext;

declare global {
  interface Window {
    webkitAudioContext?: AudioContextConstructor;
  }
}

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (sharedAudioContext) return sharedAudioContext;
  const Ctor = window.AudioContext ?? window.webkitAudioContext;
  if (!Ctor) return null;
  sharedAudioContext = new Ctor();
  return sharedAudioContext;
}

/** Closes and drops the shared AudioContext so the next primeAudioPlayback() creates a fresh one.
 *  iOS Safari's audio session gets flaky after interleaving microphone capture (SpeechRecognition)
 *  with playback across several call turns — reusing the same context indefinitely across an
 *  entire hang-up-and-call-again cycle risks carrying that stuck state into the next call. Call
 *  this when the Jarvis call mode ends so each new call starts from a clean slate. */
export function closeAudioContext(): void {
  if (sharedAudioContext) {
    sharedAudioContext.close().catch(() => {});
    sharedAudioContext = null;
  }
}

/** A ~50ms silent WAV, embedded as a data: URI — small enough that iOS Safari's documented
 *  data:/blob: <audio> unreliability (see playAudioBlob() above) doesn't apply; that problem is
 *  specific to larger dynamically-fetched clips like real spoken replies, not a clip this size. */
const SILENT_WAV_DATA_URI =
  "data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA";

let sharedSilentAudioEl: HTMLAudioElement | null = null;

/**
 * iOS Safari treats the Web Audio API and <audio>/<video> elements as separate "channels" for the
 * hardware mute (silent) switch: by default WebKit's audio session starts out "ambient", which
 * means AudioContext-driven sound (what playAudioBlob() above uses for ElevenLabs replies) is
 * muted whenever the switch is flipped to silent — confirmed, documented WebKit behavior, not
 * something a Promise/resume() call alone can fix. The known workaround (used by libraries like
 * feross/unmute-ios-audio) is to actually play a short silent clip through BOTH an <audio> element
 * and the AudioContext at the same time, inside a genuine user gesture — that dual playback nudges
 * WebKit's audio session out of "ambient" for the rest of the page session, so later AudioContext
 * playback (the real ElevenLabs reply, which arrives asynchronously after this gesture has ended)
 * is no longer silenced by the switch. Call this synchronously inside the same click/submit
 * handler as primeSpeechSynthesis() — resuming alone (the old implementation) doesn't trigger this
 * unlock, only actually playing sound does.
 */
export function primeAudioPlayback(): void {
  if (!sharedSilentAudioEl) {
    sharedSilentAudioEl = new Audio(SILENT_WAV_DATA_URI);
  }
  sharedSilentAudioEl.currentTime = 0;
  sharedSilentAudioEl.play().catch(() => {});

  const ctx = getAudioContext();
  if (!ctx) return;
  const resumeIfNeeded = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
  resumeIfNeeded
    .then(() => {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    })
    .catch(() => {});
}

/** Decodes and plays an audio Blob. Returns a stop() you can call to cancel playback early —
 *  callers that need to hang up mid-reply (the call-mode overlay) use this instead of pausing an
 *  <audio> element, since there isn't one anymore. onStart fires right as playback begins with the
 *  audio's real, exact duration in ms — unlike speak() above, decoded audio always knows this in
 *  advance, so a caption reveal synced to it can be pixel (well, character) perfect. */
export function playAudioBlob(
  blob: Blob,
  onEnd: () => void,
  onError: (err: unknown) => void,
  onStart?: (durationMs: number) => void,
): () => void {
  const ctx = getAudioContext();
  if (!ctx) {
    onError(new Error("Web Audio API não suportada neste navegador."));
    return () => {};
  }

  let source: AudioBufferSourceNode | null = null;
  let stopped = false;

  blob
    .arrayBuffer()
    .then((arrayBuffer) => {
      const resumeIfNeeded = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
      return resumeIfNeeded.then(
        () =>
          new Promise<AudioBuffer>((resolve, reject) => {
            ctx.decodeAudioData(arrayBuffer, resolve, reject);
          }),
      );
    })
    .then((audioBuffer) => {
      if (stopped) return;
      source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        if (!stopped) onEnd();
      };
      onStart?.(audioBuffer.duration * 1000);
      source.start(0);
    })
    .catch(onError);

  return () => {
    stopped = true;
    try {
      source?.stop();
    } catch {
      // Already stopped/finished — nothing to do.
    }
  };
}
