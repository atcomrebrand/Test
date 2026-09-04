import { valuesHidden } from "@/store/privacy";

/**
 * A máscara do modo privacidade.
 *
 * Largura fixa e sem símbolo de moeda de propósito. Mascarar só os dígitos preservando o formato
 * (`R$ ••.•••,••`) entregaria a ordem de grandeza — o que se quer esconder de quem está olhando por
 * cima do ombro é justamente essa.
 */
export const HIDDEN_AMOUNT = "•••••";

/**
 * Mascara valores dentro de uma frase pronta.
 *
 * Existe pros textos que o **servidor** monta com o número já embutido ("Previsão pro próximo mês
 * em as contas da Casa: R$ 1.240,00, estável..."). Esses nunca passam por `formatCurrency` — quando
 * chegam na tela já são uma string só —, e eram o único lugar da Home que continuava entregando
 * dinheiro com o modo ligado.
 */
export function maskAmountsInText(text: string): string {
  if (!valuesHidden()) return text;
  // Também US$/€, porque o CRM e a Casa lidam com moeda estrangeira.
  return text.replace(/(?:R\$|US\$|€)\s?-?[\d.]+(?:,\d+)?/g, HIDDEN_AMOUNT);
}

export function formatCurrency(value: number | string, currency = "BRL") {
  // Aqui, e não nas telas: são 399 chamadas em 76 arquivos, e uma que escapasse seria o único
  // número na tela — exatamente o que alguém repararia.
  if (valuesHidden()) return HIDDEN_AMOUNT;
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

/**
 * Horas decimais viram "7h31". Decimal puro ("7.53h") é ambíguo: parece hora e minuto, e passa
 * de 7.59 pra 7.62 sem virar hora nenhuma — o que faz o número parecer errado mesmo estando certo.
 *
 * O arredondamento é feito no TOTAL de minutos, uma vez só. Separar a hora antes e arredondar o
 * resto levava 7,9917h a virar "7h60": 0,9917 × 60 arredonda pra 60, e ninguém promovia a hora.
 */
export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}
