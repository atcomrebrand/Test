export function formatCurrency(value: number | string, currency = "BRL") {
  const num = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(num ?? 0);
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
