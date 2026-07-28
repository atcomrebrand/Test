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
  const { speakReply, stop: stopSpeaking } = useSpeakAssistantReply();

  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (open) {
      setCallState("listening");
      setCaption("");
      startListening();
    } else {
      recognitionRef.current?.stop();
      stopSpeaking();
      // Drop the shared AudioContext when a call ends — iOS Safari's audio session can get stuck
      // after interleaving mic capture (SpeechRecognition) with playback across several turns, so
      // a call that hung up cleanly could otherwise leave the next call unable to speak. Starting
      // the next call fresh (primeAudioPlayback() below recreates it) is cheap insurance.
      closeAudioContext();
    }
    return () => {
      recognitionRef.current?.stop();
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function startListening() {
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
    setCaption(text);
    setSpeechNote(null);
    speakReply(
      text,
      () => {
        if (openRef.current) startListening();
      },
      (reason) => setSpeechNote(`Não consegui usar a voz escolhida (${reason}) — falando com a voz do navegador.`),
    );
  }

  function handleHangUp() {
    recognitionRef.current?.stop();
    stopSpeaking();
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
