import { useEffect, useState } from "react";
import { parseAmountInput } from "@/lib/format";

interface Props {
  value: number;
  onSave: (value: number) => void;
  disabled?: boolean;
  /** While `value` is still 0, prefills the field with this presumed number (in blue) instead of
   *  "0" — confirming it with Enter/blur saves it as the real value, same as typing it by hand.
   *  Once a real (nonzero) value exists, this stops applying on its own. Purely a convenience
   *  nudge, never written anywhere on its own. */
  presumedValue?: number | null;
}

/** Click-to-edit currency cell for the monthly tables — saves on blur/Enter, so there's no
 *  separate "editar" screen for something as frequent as marking an amount reserved or paid.
 *  Plain text input (not type="number") so typing a comma decimal ("150,50", the pt-BR way)
 *  doesn't get silently mangled by the browser's number-input keystroke filter. */
export function InlineAmountCell({ value, onSave, disabled, presumedValue }: Props) {
  const isPresumed = value === 0 && !!presumedValue;
  const startingValue = isPresumed ? (presumedValue as number) : value;
  const [draft, setDraft] = useState(String(startingValue));

  useEffect(() => {
    setDraft(String(startingValue));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, presumedValue]);

  function commit() {
    const parsed = parseAmountInput(draft);
    if (!Number.isNaN(parsed) && parsed !== value) onSave(parsed);
    else setDraft(String(startingValue));
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
      className={`h-8 w-28 rounded-lg border border-[rgb(var(--border))] surface px-2 text-right text-sm outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 ${
        isPresumed ? "text-blue-500 dark:text-blue-400" : ""
      }`}
    />
  );
}
