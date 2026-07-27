import { FormEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Mic, Phone, Send, User, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAssistantChat, ChatMessage } from "@/features/useAssistant";
import { useAssistantVoiceStore } from "@/store/assistantVoice";
import {
  createSpeechRecognition,
  extractLatestResult,
  isSpeechRecognitionSupported,
  primeSpeechSynthesis,
  speak,
  SpeechRecognitionLike,
} from "@/lib/speech";
import { AssistantCallOverlay } from "./AssistantCallOverlay";

const micSupported = isSpeechRecognitionSupported();

/**
 * Mounted once in AppLockGate so it floats above every authenticated screen, in every module —
 * not scoped to one route. Messages live in this component's own state, so the conversation
 * survives navigation between modules for as long as the tab stays open (lost on reload, same as
 * any other in-memory chat). Also owns the shared conversation passed into AssistantCallOverlay,
 * so switching between typing and the voice "call" mode continues the same thread.
 */
export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const chat = useAssistantChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceEnabled = useAssistantVoiceStore((s) => s.voiceEnabled);
  const toggleVoice = useAssistantVoiceStore((s) => s.toggleVoice);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chat.isPending, open]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || chat.isPending) return;

    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    // Must happen synchronously inside this click/submit handler — priming after the async
    // response arrives is too late for browsers that gate speechSynthesis on a live user gesture.
    if (voiceEnabled) primeSpeechSynthesis();

    chat.mutate(next, {
      onSuccess: (res) => {
        setMessages(res.messages);
        const last = res.messages[res.messages.length - 1];
        if (voiceEnabled && last?.role === "assistant") speak(last.content);
      },
    });
  }

  function toggleMic() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = createSpeechRecognition({ continuous: false, interimResults: false });
    if (!recognition) return;
    recognitionRef.current = recognition;
    recognition.onresult = (event) => {
      const { transcript, isFinal } = extractLatestResult(event);
      if (isFinal) setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
    setListening(true);
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar assistente" : "Abrir assistente"}
        className="fixed bottom-[calc(9rem_+_env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-white shadow-elevated transition-transform active:scale-95 md:bottom-20 md:right-6"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="fixed bottom-[calc(15rem_+_env(safe-area-inset-bottom))] right-4 z-40 flex h-[32rem] max-h-[70vh] w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-[rgb(var(--border))] surface shadow-elevated md:bottom-40 md:right-6"
          >
            <div className="flex items-center justify-between border-b border-[rgb(var(--border))] px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Assistente</p>
                <p className="truncate text-xs text-muted">Pergunte sobre seus cartões, contas ou investimentos.</p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  onClick={toggleVoice}
                  className="rounded-lg p-1.5 text-muted hover:surface-2"
                  aria-label={voiceEnabled ? "Desativar leitura em voz alta" : "Ativar leitura em voz alta"}
                  title={voiceEnabled ? "Leitura em voz alta ligada" : "Leitura em voz alta desligada"}
                >
                  {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </button>
                {micSupported && (
                  <button
                    onClick={() => {
                      primeSpeechSynthesis();
                      setCallOpen(true);
                    }}
                    className="rounded-lg p-1.5 text-muted hover:surface-2"
                    aria-label="Ligar (modo voz)"
                    title="Conversar por voz"
                  >
                    <Phone className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-muted hover:surface-2" aria-label="Fechar">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                  <Bot className="h-8 w-8 text-muted" />
                  <p className="text-sm font-medium">Pergunte qualquer coisa</p>
                  <p className="max-w-xs text-xs text-muted">
                    Ex: "Quanto vou pagar de cartão em agosto?" ou "Quantas horas trabalhei esse mês?"
                  </p>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} className={`flex items-start gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                        m.role === "user" ? "bg-accent-500 text-white" : "surface-2 text-[rgb(var(--text))]"
                      }`}
                    >
                      {m.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                    </div>
                    <div
                      className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-soft ${
                        m.role === "user" ? "bg-accent-500 text-white" : "surface-2"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))
              )}

              {chat.isPending && (
                <div className="flex items-start gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg surface-2">
                    <Bot className="h-3 w-3" />
                  </div>
                  <div className="flex items-center gap-1 rounded-2xl surface-2 px-3 py-2.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
                  </div>
                </div>
              )}

              {chat.isError && <p className="text-center text-xs text-red-500">{chat.error?.message}</p>}

              <div ref={bottomRef} />
            </div>

            <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-[rgb(var(--border))] p-3">
              {micSupported && (
                <button
                  type="button"
                  onClick={toggleMic}
                  aria-label={listening ? "Parar de ouvir" : "Falar"}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                    listening ? "animate-pulse bg-red-500 text-white" : "surface-2 text-muted hover:text-[rgb(var(--text))]"
                  }`}
                >
                  <Mic className="h-4 w-4" />
                </button>
              )}
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={listening ? "Ouvindo..." : "Escreva sua pergunta..."}
                disabled={chat.isPending}
                className="h-10 flex-1 rounded-xl border border-[rgb(var(--border))] surface px-3 text-sm outline-none focus:ring-2 focus:ring-accent-500/50"
              />
              <Button type="submit" size="icon" disabled={!input.trim()} loading={chat.isPending} aria-label="Enviar">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AssistantCallOverlay open={callOpen} onClose={() => setCallOpen(false)} messages={messages} setMessages={setMessages} />
    </>
  );
}
