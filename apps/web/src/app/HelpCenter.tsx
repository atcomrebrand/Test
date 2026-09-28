import { useEffect, useRef } from "react";
import { Keyboard, Lightbulb } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useUiStore } from "@/store/ui";
import { HELP_TOPICS, CLOSING_DAY_EXAMPLE } from "./helpContent";

export function HelpCenter() {
  const helpOpen = useUiStore((s) => s.helpOpen);
  const helpTopic = useUiStore((s) => s.helpTopic);
  const setHelpOpen = useUiStore((s) => s.setHelpOpen);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (helpOpen && helpTopic && refs.current[helpTopic]) {
      setTimeout(() => refs.current[helpTopic]?.scrollIntoView({ block: "start" }), 80);
    }
  }, [helpOpen, helpTopic]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setHelpOpen(!helpOpen);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [helpOpen, setHelpOpen]);

  return (
    <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Central de Ajuda" size="xl">
      <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
        <div className="flex items-start gap-3 rounded-xl bg-accent-500/10 p-4">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-accent-500" />
          <div>
            <p className="text-sm font-semibold">{CLOSING_DAY_EXAMPLE.title}</p>
            <p className="mt-1 text-sm text-muted">{CLOSING_DAY_EXAMPLE.body}</p>
          </div>
        </div>

        <div className="space-y-5">
          {HELP_TOPICS.map((topic) => (
            <div
              key={topic.id}
              ref={(el) => {
                refs.current[topic.id] = el;
              }}
              className="scroll-mt-2 rounded-2xl border border-[rgb(var(--border))] p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 text-accent-500">
                  <topic.icon className="h-4 w-4" />
                </span>
                <h3 className="font-semibold">{topic.title}</h3>
              </div>
              <p className="text-sm text-muted">{topic.summary}</p>
              {topic.tips.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {topic.tips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent-500" />
                      <span className="text-muted">{tip}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-start gap-3 rounded-xl surface-2 p-4">
          <Keyboard className="mt-0.5 h-5 w-5 shrink-0 text-muted" />
          <div className="text-sm">
            <p className="font-semibold">Atalho de teclado</p>
            <p className="text-muted">
              <kbd className="rounded surface px-1.5 py-0.5 font-mono text-xs">Ctrl</kbd> +{" "}
              <kbd className="rounded surface px-1.5 py-0.5 font-mono text-xs">K</kbd> (ou{" "}
              <kbd className="rounded surface px-1.5 py-0.5 font-mono text-xs">⌘K</kbd> no Mac) abre a busca rápida
              de compras, cartões e categorias de qualquer tela.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
