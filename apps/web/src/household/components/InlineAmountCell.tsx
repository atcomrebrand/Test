import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { parseAmountInput } from "@/lib/format";
import { formatCurrency } from "@/lib/format";

interface Props {
  value: number;
  onSave: (value: number) => void;
  disabled?: boolean;
  /** While `value` is still 0, prefills the field with this presumed number (in blue) instead of
   *  "0". Confirming it — via the checkmark button or pressing Enter without editing — saves it
   *  as the real value, same as typing it by hand. Just focusing and blurring away WITHOUT editing
   *  never saves anything by itself (a stray tap while scrolling shouldn't silently lock in a
   *  number nobody confirmed). Once a real (nonzero) value exists, this stops applying on its own.
   *  Never written anywhere on its own. */
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
  const touchedRef = useRef(false);

  useEffect(() => {
    setDraft(String(startingValue));
    touchedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, presumedValue]);

  function commit(forceConfirmUntouched = false) {
    // An untouched presumed prefill must never save from a mere focus/blur (e.g. a stray tap while
    // scrolling) — only an explicit edit or an explicit confirm (checkmark / Enter) counts.
    if (isPresumed && !touchedRef.current && !forceConfirmUntouched) return;
    const parsed = parseAmountInput(draft);
    if (!Number.isNaN(parsed) && parsed !== value) onSave(parsed);
    else setDraft(String(startingValue));
  }

  if (disabled) {
    return <span className="text-muted">{formatCurrency(Number(value))}</span>;
  }

  const showConfirm = isPresumed && !touchedRef.current;

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => {
          touchedRef.current = true;
          setDraft(e.target.value);
        }}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          commit(true);
          e.currentTarget.blur();
        }}
        className={`h-8 w-28 rounded-lg border border-[rgb(var(--border))] surface px-2 text-right text-base outline-none transition-colors focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 sm:text-sm ${
          isPresumed ? "text-blue-500 dark:text-blue-400" : ""
        }`}
      />
      {showConfirm && (
        <button
          type="button"
          onClick={() => commit(true)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-blue-500 transition-colors hover:bg-blue-500/10 dark:text-blue-400"
          aria-label="Confirmar valor presumido"
        >
          <Check className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
