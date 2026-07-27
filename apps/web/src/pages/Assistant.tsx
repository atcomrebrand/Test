import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bot, Send, User } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAssistantChat, ChatMessage } from "@/features/useAssistant";

export default function Assistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const chat = useAssistantChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chat.isPending]);

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
    <div className="mx-auto flex h-screen max-w-3xl flex-col px-4 md:px-8">
      <div className="flex items-center justify-between pb-2 pt-[calc(1rem_+_env(safe-area-inset-top))]">
        <Link
          to="/"
          className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted transition-colors hover:surface-2 hover:text-[rgb(var(--text))]"
        >
          <ArrowLeft className="h-4 w-4" />
          Início
        </Link>
      </div>

      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Assistente</h1>
        <p className="mt-1 text-sm text-muted">Pergunte sobre seus cartões, contas da casa ou investimentos.</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pb-4">
        {messages.length === 0 ? (
          <EmptyState
            icon={<Bot className="h-6 w-6" />}
            title="Pergunte qualquer coisa"
            description={'Ex: "Quanto vou pagar de cartão em agosto?" ou "Como tá minha carteira de investimentos?"'}
          />
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex items-start gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                  m.role === "user" ? "bg-accent-500 text-white" : "surface-2 text-[rgb(var(--text))]"
                }`}
              >
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm shadow-soft ${
                  m.role === "user" ? "bg-accent-500 text-white" : "surface"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}

        {chat.isPending && (
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl surface-2">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl surface px-4 py-3 shadow-soft">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
            </div>
          </div>
        )}

        {chat.isError && <p className="text-center text-sm text-red-500">{chat.error?.message}</p>}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-[rgb(var(--border))] py-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escreva sua pergunta..."
          disabled={chat.isPending}
          className="h-11 flex-1 rounded-xl border border-[rgb(var(--border))] surface px-4 text-sm outline-none focus:ring-2 focus:ring-accent-500/50"
        />
        <Button type="submit" size="icon" disabled={!input.trim()} loading={chat.isPending} aria-label="Enviar">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
