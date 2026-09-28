import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mic, PhoneOff, Volume2 } from "lucide-react";
import { useAssistantChat, ChatMessage } from "@/features/useAssistant";
import { useSpeakAssistantReply } from "@/features/useAssistantSpeech";
import { closeAudioContext, createSpeechRecognition, extractLatestResult, SpeechRecognitionLike } from "@/lib/speech";

type CallState = "listening" | "thinking" | "speaking" | "error";

interface AssistantCallOverlayProps {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
}

const STATE_LABEL: Record<CallState, string> = {
  listening: "Ouvindo...",
  thinking: "Pensando...",
  speaking: "Falando...",
  error: "Deu ruim",
};

const GREETING = "Oi, Mauro! Como posso te ajudar hoje?";

/**
 * Full-screen hands-free "call" mode: listen -> send -> speak -> listen again, on a loop, until
 * the user hangs up. There's no real-time speech-to-speech model behind this — each turn is a
 * normal text round-trip to /assistant/chat, so expect a few seconds of "Pensando..." per reply,
 * not instant back-and-forth. Recognition auto-stops on silence (continuous: false), which is what
 * drives each turn boundary; onend restarts listening for the next one.
 */
export function AssistantCallOverlay({ open, onClose, messages, setMessages }: AssistantCallOverlayProps) {
  const [callState, setCallState] = useState<CallState>("listening");
  const [caption, setCaption] = useState("");
  const [speechNote, setSpeechNote] = useState<string | null>(null);
  const chat = useAssistantChat();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const openRef = useRef(open);
  const messagesRef = useRef(messages);
  const typewriterIdRef = useRef<number | null>(null);
  const pendingListenIdRef = useRef<number | null>(null);
  const { speakReply, stop: stopSpeaking } = useSpeakAssistantReply();

  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (open) {
      // Greet first, then start listening once the greeting finishes speaking — mirrors the
      // listen/thinking/speaking turn structure below (mic off while something is being spoken).
      respondAndListen(GREETING);
    } else {
      stopRecognitionHard();
      stopSpeaking();
      clearTypewriter();
      clearPendingListen();
      // Drop the shared AudioContext when a call ends — iOS Safari's audio session can get stuck
      // after interleaving mic capture (SpeechRecognition) with playback across several turns, so
      // a call that hung up cleanly could otherwise leave the next call unable to speak. Starting
      // the next call fresh (primeAudioPlayback() below recreates it) is cheap insurance.
      closeAudioContext();
    }
    return () => {
      stopRecognitionHard();
      stopSpeaking();
      clearTypewriter();
      clearPendingListen();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function clearTypewriter() {
    if (typewriterIdRef.current !== null) {
      window.clearInterval(typewriterIdRef.current);
      typewriterIdRef.current = null;
    }
  }

  function clearPendingListen() {
    if (pendingListenIdRef.current !== null) {
      window.clearTimeout(pendingListenIdRef.current);
      pendingListenIdRef.current = null;
    }
  }

  /** Reveals `text` progressively, roughly in sync with how long it takes to actually say it —
   *  called from speakReply's onStart (once audio genuinely begins), not from respondAndListen
   *  itself, so nothing shows on screen during the silent gap while a reply is being
   *  fetched/synthesized. A subtitle-style reveal reads as far more "alive" than the full reply
   *  appearing all at once. */
  function startTypewriter(text: string, durationMs: number) {
    clearTypewriter();
    const start = performance.now();
    const safeDuration = Math.max(durationMs, 300);
    typewriterIdRef.current = window.setInterval(() => {
      const fraction = Math.min((performance.now() - start) / safeDuration, 1);
      setCaption(text.slice(0, Math.ceil(text.length * fraction)));
      if (fraction >= 1) clearTypewriter();
    }, 40);
  }

  /** stop() on iOS Safari's webkitSpeechRecognition is unreliable about actually releasing the
   *  microphone — it can leave the recording session (and the mic permission prompt) stuck
   *  active. abort() plus tearing down the handlers first (so a delayed onend can't sneak in a
   *  fresh startListening() after we've already torn down) releases it immediately instead. */
  function stopRecognitionHard() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.abort();
    recognitionRef.current = null;
  }

  function startListening() {
    stopRecognitionHard();
    const recognition = createSpeechRecognition({ continuous: false, interimResults: true });
    if (!recognition) {
      setCallState("error");
      setCaption("Reconhecimento de voz não suportado neste navegador.");
      return;
    }
    recognitionRef.current = recognition;
    setCallState("listening");
    setCaption("");

    let finalTranscript = "";
    let fatalError = false;
    recognition.onresult = (event) => {
      const { transcript, isFinal } = extractLatestResult(event);
      setCaption(transcript);
      if (isFinal) finalTranscript = transcript;
    };
    recognition.onerror = (event) => {
      // "no-speech"/"aborted"/"network" are routine (silence, a cut-off turn) — onend below
      // restarts listening for those. Only mic-permission errors are fatal and stop the loop.
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        fatalError = true;
        setCallState("error");
        setCaption("Permissão de microfone negada — libere o microfone pro navegador e tente de novo.");
      }
    };
    recognition.onend = () => {
      if (!openRef.current || fatalError) return;
      if (finalTranscript.trim()) {
        sendTurn(finalTranscript.trim());
      } else {
        startListening();
      }
    };
    recognition.start();
  }

  function sendTurn(content: string) {
    // The recognition that captured this turn already ended on its own (continuous: false stops
    // it after the user goes quiet), but iOS Safari doesn't always release the microphone hardware
    // just because the recognition object considers itself done — force it now so the mic is
    // truly off for the whole thinking + speaking stretch, not just from the UI's point of view.
    stopRecognitionHard();
    setCallState("thinking");
    setCaption(content);
    const next = [...messagesRef.current, { role: "user" as const, content }];
    setMessages(next);

    chat.mutate(next, {
      onSuccess: (res) => {
        setMessages(res.messages);
        const last = res.messages[res.messages.length - 1];
        respondAndListen(last?.content ?? "Não consegui gerar uma resposta.");
      },
      onError: (err) => {
        respondAndListen(err.message);
      },
    });
  }

  function respondAndListen(text: string) {
    setCallState("speaking");
    // Nothing shown yet — startTypewriter() (fired from onStart, once audio genuinely begins)
    // reveals it progressively instead of dumping the whole reply on screen immediately.
    setCaption("");
    setSpeechNote(null);
    speakReply(
      text,
      () => {
        clearTypewriter();
        // Show the complete reply and let it sit on screen for a beat before clearing for the
        // next turn — startListening() below clears the caption immediately, so without this
        // pause the reveal would jump straight from a partial line to blank, never actually
        // showing the finished sentence (the duration passed to startTypewriter is only an
        // estimate, so it rarely finishes exactly when speech does).
        setCaption(text);
        if (openRef.current) {
          pendingListenIdRef.current = window.setTimeout(() => {
            pendingListenIdRef.current = null;
            if (openRef.current) startListening();
          }, 400);
        }
      },
      (reason) => setSpeechNote(`Não consegui usar a voz escolhida (${reason}) — falando com a voz do navegador.`),
      (durationMs) => startTypewriter(text, durationMs),
    );
  }

  function handleHangUp() {
    stopRecognitionHard();
    stopSpeaking();
    clearTypewriter();
    clearPendingListen();
    onClose();
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-[rgb(var(--bg))] px-6 pb-[calc(2rem_+_env(safe-area-inset-bottom))] pt-[calc(3rem_+_env(safe-area-inset-top))]"
      >
        <div className="text-center">
          <p className="text-sm font-medium text-muted">Assistente</p>
          <p className="mt-1 text-lg font-semibold">{STATE_LABEL[callState]}</p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-8">
          <div className="relative flex h-40 w-40 items-center justify-center">
            {callState === "listening" && (
              <motion.span
                className="absolute inset-0 rounded-full bg-accent-500/20"
                animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0.2, 0.6] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            {callState === "speaking" && (
              <motion.span
                className="absolute inset-0 rounded-full bg-emerald-500/20"
                animate={{ scale: [1, 1.15, 1], opacity: [0.7, 0.35, 0.7] }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <div
              className={`flex h-28 w-28 items-center justify-center rounded-full text-white shadow-elevated ${
                callState === "error" ? "bg-red-500" : callState === "speaking" ? "bg-emerald-500" : "bg-accent-500"
              }`}
            >
              {callState === "listening" && <Mic className="h-10 w-10" />}
              {callState === "thinking" && <Loader2 className="h-10 w-10 animate-spin" />}
              {callState === "speaking" && <Volume2 className="h-10 w-10" />}
              {callState === "error" && <Mic className="h-10 w-10" />}
            </div>
          </div>

          {caption && <p className="max-w-sm text-center text-sm text-muted">{caption}</p>}
          {speechNote && <p className="max-w-sm text-center text-xs text-amber-500">{speechNote}</p>}
        </div>

        <button
          onClick={handleHangUp}
          aria-label="Encerrar chamada"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-elevated transition-transform active:scale-95"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
