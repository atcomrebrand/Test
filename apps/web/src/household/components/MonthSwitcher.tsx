import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel } from "@/lib/format";

interface Props {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}

/** Shared prev/next month control — every Casa screen (Dashboard, Contas, Cartões, Entradas) reads
 *  its data for one competência mensal at a time, so they all need the exact same switcher. */
export function MonthSwitcher({ year, month, onChange }: Props) {
  function goPrev() {
    if (month === 1) onChange(year - 1, 12);
    else onChange(year, month - 1);
  }

  function goNext() {
    if (month === 12) onChange(year + 1, 1);
    else onChange(year, month + 1);
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={goPrev} className="rounded-lg p-2 hover:surface-2" aria-label="Mês anterior">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <p className="w-32 text-center text-sm font-semibold capitalize">{monthLabel(month, year)}</p>
      <button onClick={goNext} className="rounded-lg p-2 hover:surface-2" aria-label="Próximo mês">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
