import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Layers } from "lucide-react";
import { cn } from "@/lib/cn";
import { useCrmPortfolios } from "./api";
import { useCrmStore } from "./store";

/**
 * Seletor global de serviço (§2).
 *
 * Fica no header e vale pra todas as telas. "Todos" é uma opção explícita e não o estado padrão
 * disfarçado: o briefing é claro que dados dos dois serviços não podem se misturar sem a pessoa ter
 * escolhido isso, então o rótulo diz sempre em qual recorte a tela está.
 */
export function PortfolioSwitcher() {
  const { data: portfolios } = useCrmPortfolios();
  const portfolioId = useCrmStore((s) => s.portfolioId);
  const setPortfolioId = useCrmStore((s) => s.setPortfolioId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const selected = portfolios?.find((p) => p.id === portfolioId) ?? null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-[rgb(var(--border))] px-3 py-1.5 text-sm font-medium transition-colors hover:surface-2"
      >
        {selected ? (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: selected.color }} />
        ) : (
          <Layers className="h-3.5 w-3.5 text-muted" />
        )}
        <span className="max-w-[10rem] truncate">{selected?.name ?? "Todos os serviços"}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="surface absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-xl border border-[rgb(var(--border))] shadow-lg">
          <button
            type="button"
            onClick={() => {
              setPortfolioId(null);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:surface-2"
          >
            <Layers className="h-3.5 w-3.5 text-muted" />
            <span className="flex-1">Todos os serviços</span>
            {portfolioId === null && <Check className="h-3.5 w-3.5 text-indigo-500" />}
          </button>

          <div className="h-px bg-[rgb(var(--border))]" />

          {portfolios?.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setPortfolioId(p.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:surface-2"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="flex-1 truncate">{p.name}</span>
              {portfolioId === p.id && <Check className="h-3.5 w-3.5 text-indigo-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
