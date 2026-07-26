export function formatCurrency(value: number | string, currency = "BRL") {
  const num = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(num ?? 0);
}

/** Parses a currency amount typed by hand, accepting both "150,50" (pt-BR) and "150.50" (en-US) —
 *  a plain `Number()` on "150,50" gives NaN, and a native `<input type="number">` silently drops
 *  the comma as you type it, turning "150,50" into "15050". When both separators are present, the
 *  last one wins as the decimal point and the other is treated as a thousands separator. Returns
 *  NaN for empty/unparseable input, same as Number() would. */
export function parseAmountInput(raw: string): number {
  const s = raw.trim();
  if (!s) return NaN;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  let normalized = s;
  if (lastComma !== -1 && lastDot !== -1) {
    normalized = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma !== -1) {
    normalized = s.replace(",", ".");
  }

  return Number(normalized);
}

/** Renders null as "—" instead of "0,0%" — a missing indicator should never look like a real
 *  zero. */
export function formatPercent(value: number | null | undefined, decimals = 1) {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}

export function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", options ?? { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function monthLabel(month: number, year: number, short = false) {
  const name = short ? MONTH_SHORT[month - 1] : MONTH_NAMES[month - 1];
  return `${name} ${year}`;
}

export function daysUntil(date: string | Date) {
  const target = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}
