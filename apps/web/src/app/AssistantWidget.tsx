import { FormEvent, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Send, User, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAssistantChat, ChatMessage } from "@/features/useAssistant";

/**
 * Mounted once in AppLockGate so it floats above every authenticated screen, in every module —
 * not scoped to one route. Messages live in this component's own state, so the conversation
 * survives navigation between modules for as long as the tab stays open (lost on reload, same as
 * any other in-memory chat).
 */
export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const chat = useAssistantChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chat.isPending, open]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || chat.isPending) return;

    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");

    chat.mutate(next, {
      onSuccess: (res) => setMessages(res.messages),
    });
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
              <div>
                <p className="text-sm font-semibold">Assistente</p>
                <p className="text-xs text-muted">Pergunte sobre seus cartões, contas ou investimentos.</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-muted hover:surface-2" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
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
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escreva sua pergunta..."
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
    </>
  );
}
