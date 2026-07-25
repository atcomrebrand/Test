import { useEffect, useState } from "react";
import { parseAmountInput } from "@/lib/format";

interface Props {
  value: number;
  onSave: (value: number) => void;
  disabled?: boolean;
}

/** Click-to-edit currency cell for the monthly tables — saves on blur/Enter, so there's no
 *  separate "editar" screen for something as frequent as marking an amount reserved or paid.
 *  Plain text input (not type="number") so typing a comma decimal ("150,50", the pt-BR way)
 *  doesn't get silently mangled by the browser's number-input keystroke filter. */
export function InlineAmountCell({ value, onSave, disabled }: Props) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit() {
    const parsed = parseAmountInput(draft);
    if (!Number.isNaN(parsed) && parsed !== value) onSave(parsed);
    else setDraft(String(value));
  }

  if (disabled) {
    return <span className="text-muted">{Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>;
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="h-8 w-28 rounded-lg border border-[rgb(var(--border))] surface px-2 text-right text-sm outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
    />
  );
}
