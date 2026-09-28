import { ProfitChannelType } from "./types";

/**
 * Design system do Lucro Certo, num lugar só.
 *
 * A cor é o **teal**: era o maior vão livre no carrossel da Home (esmeralda, violeta, âmbar, rosa,
 * sky, lima e índigo já estavam tomados), e dois módulos de cor parecida ali viram um só de relance.
 *
 * Sobre o teal cheio o texto é **branco** — diferente do lima da Academia, que é claro demais e
 * exige texto escuro.
 */
export const PROFIT = {
  solid: "bg-teal-600",
  solidHover: "hover:bg-teal-500",
  text: "text-teal-600 dark:text-teal-400",
  soft: "bg-teal-500/10",
  border: "border-teal-500/30",
  hex: "#0D9488",
} as const;

/** Verde pro que dá lucro, vermelho pro que dá prejuízo. É a única leitura que importa de relance,
 *  e ela não depende de saber os números. */
export function toneForProfit(profit: number): string {
  if (profit > 0) return "text-emerald-600 dark:text-emerald-400";
  if (profit < 0) return "text-red-500";
  return "text-muted";
}

export const CHANNEL_LABEL: Record<ProfitChannelType, string> = {
  MARKETPLACE: "Marketplace",
  DIRECT: "Venda direta",
  OWN_STORE: "Loja própria",
  WHOLESALE: "Atacado",
};

/** Percentual do jeito que se lê em português, sem casa decimal inútil: "20%" e não "20,00%". */
export function formatPercent(value: number, casas = 2): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;
}
