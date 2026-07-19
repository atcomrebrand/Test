import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search, CreditCard, ShoppingBag, Tag as TagIcon, ArrowRight } from "lucide-react";
import { useUiStore } from "@/store/ui";
import { useGlobalSearch } from "@/features/useSearch";
import { formatCurrency, formatDate } from "@/lib/format";

export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { data, isFetching } = useGlobalSearch(query);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setQuery("");
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-[rgb(var(--border))] surface shadow-elevated"
          >
            <div className="flex items-center gap-3 border-b border-[rgb(var(--border))] px-4 py-3">
              <Search className="h-4 w-4 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar compras, cartões, categorias..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
              />
              <kbd className="rounded surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">esc</kbd>
            </div>

            <div className="max-h-96 overflow-y-auto p-2">
              {query.trim().length <= 1 && (
                <p className="p-4 text-center text-sm text-muted">Digite ao menos 2 caracteres para buscar.</p>
              )}
              {isFetching && <p className="p-4 text-center text-sm text-muted">Buscando...</p>}

              {data?.cards && data.cards.length > 0 && (
                <div className="mb-2">
                  <p className="px-2 py-1 text-xs font-semibold uppercase text-muted">Cartões</p>
                  {data.cards.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        navigate("/cards");
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:surface-2"
                    >
                      <CreditCard className="h-4 w-4 text-accent-500" />
                      <span className="flex-1">{c.name}</span>
                      <span className="text-xs text-muted">{c.bank}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted" />
                    </button>
                  ))}
                </div>
              )}

              {data?.purchases && data.purchases.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-xs font-semibold uppercase text-muted">Compras</p>
                  {data.purchases.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        navigate("/purchases");
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:surface-2"
                    >
                      <ShoppingBag className="h-4 w-4 text-accent-500" />
                      <span className="flex-1 truncate">{p.name}</span>
                      {p.category && (
                        <span className="hidden items-center gap-1 text-xs text-muted sm:flex">
                          <TagIcon className="h-3 w-3" /> {p.category.name}
                        </span>
                      )}
                      <span className="text-xs font-medium">{formatCurrency(p.totalAmount)}</span>
                      <span className="hidden text-xs text-muted md:inline">{formatDate(p.purchaseDate)}</span>
                    </button>
                  ))}
                </div>
              )}

              {data && data.cards.length === 0 && data.purchases.length === 0 && query.trim().length > 1 && !isFetching && (
                <p className="p-4 text-center text-sm text-muted">Nenhum resultado para "{query}".</p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
