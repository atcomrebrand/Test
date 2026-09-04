import { InvestmentAsset, InvestmentFixedIncome } from "./types";

/**
 * Ordenação da carteira.
 *
 * A regra que atravessa o arquivo: **nulo nunca vira zero**. Um ativo sem cotação tem
 * `currentValue: null` — tratar isso como 0 o colocaria no fim de "maior valor" como se não
 * valesse nada, quando na verdade é desconhecido. Aqui ele vai pro fim da lista nos dois sentidos,
 * porque é o único lugar honesto: nem "vale muito" nem "vale pouco".
 */

export type AssetSort =
  | "default"
  | "value-desc"
  | "value-asc"
  | "profit-desc"
  | "profit-asc"
  | "percent-desc"
  | "percent-asc"
  | "dividends-desc"
  | "ticker-asc";

export const ASSET_SORT_OPTIONS: { value: AssetSort; label: string }[] = [
  { value: "default", label: "Favoritos primeiro" },
  { value: "value-desc", label: "Maior valor" },
  { value: "value-asc", label: "Menor valor" },
  { value: "profit-desc", label: "Maior lucro" },
  { value: "profit-asc", label: "Maior prejuízo" },
  { value: "percent-desc", label: "Maior rentabilidade" },
  { value: "percent-asc", label: "Pior rentabilidade" },
  { value: "dividends-desc", label: "Mais proventos" },
  { value: "ticker-asc", label: "Ticker (A–Z)" },
];

export type FixedIncomeSort =
  | "default"
  | "net-desc"
  | "net-asc"
  | "yield-desc"
  | "percent-desc"
  | "maturity-asc"
  | "application-desc"
  | "institution-asc";

export const FIXED_INCOME_SORT_OPTIONS: { value: FixedIncomeSort; label: string }[] = [
  { value: "default", label: "Padrão" },
  { value: "net-desc", label: "Maior valor líquido" },
  { value: "net-asc", label: "Menor valor líquido" },
  { value: "yield-desc", label: "Maior rendimento" },
  { value: "percent-desc", label: "Maior rentabilidade" },
  { value: "maturity-asc", label: "Vence primeiro" },
  { value: "application-desc", label: "Aplicação mais recente" },
  { value: "institution-asc", label: "Instituição (A–Z)" },
];

/**
 * Comparador numérico que empurra `null` pro fim independente da direção.
 *
 * `desc` inverte só a comparação entre números conhecidos — se invertesse tudo, os desconhecidos
 * apareceriam no topo de "menor valor" e a lista pareceria começar pelo nada.
 */
function byNumber(a: number | null, b: number | null, direction: "asc" | "desc"): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === "desc" ? b - a : a - b;
}

/** O empate volta pro ticker: sem isso a ordem de dois ativos iguais muda a cada render. */
function tiebreak(a: InvestmentAsset, b: InvestmentAsset): number {
  return a.ticker.localeCompare(b.ticker, "pt-BR");
}

export function sortAssets(assets: InvestmentAsset[], sort: AssetSort): InvestmentAsset[] {
  // O padrão é a ordem que o backend já devolve (favoritos primeiro, depois mais recentes). Não
  // reordenar aqui mantém o comportamento de antes pra quem não escolher nada.
  if (sort === "default") return assets;

  const copy = [...assets];

  switch (sort) {
    case "value-desc":
      return copy.sort((a, b) => byNumber(a.currentValue, b.currentValue, "desc") || tiebreak(a, b));
    case "value-asc":
      return copy.sort((a, b) => byNumber(a.currentValue, b.currentValue, "asc") || tiebreak(a, b));
    case "profit-desc":
      return copy.sort((a, b) => byNumber(a.profit, b.profit, "desc") || tiebreak(a, b));
    case "profit-asc":
      return copy.sort((a, b) => byNumber(a.profit, b.profit, "asc") || tiebreak(a, b));
    case "percent-desc":
      return copy.sort((a, b) => byNumber(a.profitPercent, b.profitPercent, "desc") || tiebreak(a, b));
    case "percent-asc":
      return copy.sort((a, b) => byNumber(a.profitPercent, b.profitPercent, "asc") || tiebreak(a, b));
    case "dividends-desc":
      // dividendsReceived é sempre número (0 quando não houve), então aqui zero é zero mesmo.
      return copy.sort((a, b) => b.dividendsReceived - a.dividendsReceived || tiebreak(a, b));
    case "ticker-asc":
      return copy.sort(tiebreak);
    default:
      return copy;
  }
}

export function sortFixedIncomes(
  items: InvestmentFixedIncome[],
  sort: FixedIncomeSort,
): InvestmentFixedIncome[] {
  if (sort === "default") return items;

  const copy = [...items];
  const byInstitution = (a: InvestmentFixedIncome, b: InvestmentFixedIncome) =>
    a.institution.localeCompare(b.institution, "pt-BR");
  const date = (v: string) => new Date(v).getTime();

  switch (sort) {
    case "net-desc":
      return copy.sort((a, b) => b.calculation.netValue - a.calculation.netValue || byInstitution(a, b));
    case "net-asc":
      return copy.sort((a, b) => a.calculation.netValue - b.calculation.netValue || byInstitution(a, b));
    case "yield-desc":
      return copy.sort((a, b) => b.calculation.netYield - a.calculation.netYield || byInstitution(a, b));
    case "percent-desc":
      return copy.sort(
        (a, b) => b.calculation.netProfitabilityPercent - a.calculation.netProfitabilityPercent || byInstitution(a, b),
      );
    case "maturity-asc":
      return copy.sort((a, b) => date(a.maturityDate) - date(b.maturityDate) || byInstitution(a, b));
    case "application-desc":
      return copy.sort((a, b) => date(b.applicationDate) - date(a.applicationDate) || byInstitution(a, b));
    case "institution-asc":
      return copy.sort(byInstitution);
    default:
      return copy;
  }
}

/**
 * Totais do que está sendo mostrado. Aparecem ao lado do seletor porque, depois de ordenar, a
 * pergunta seguinte costuma ser "e isso tudo dá quanto".
 */
export function summarizeAssets(assets: InvestmentAsset[]) {
  let value = 0;
  let profit = 0;
  // Conta quantos ficaram de fora da soma: um total que ignora três ativos em silêncio engana.
  let withoutPrice = 0;

  for (const a of assets) {
    if (a.currentValue === null) withoutPrice += 1;
    else value += a.currentValue;
    if (a.profit !== null) profit += a.profit;
  }

  return { count: assets.length, value, profit, withoutPrice };
}
