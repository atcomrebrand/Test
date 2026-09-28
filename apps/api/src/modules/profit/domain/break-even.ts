import { UnitEconomics, computeUnitEconomics } from "./pricing";

/**
 * Ponto de equilíbrio, metas e o estrago de um desconto.
 *
 * O que separa este arquivo do `pricing.ts` é o **custo fixo**: lá tudo é por unidade, aqui entra o
 * que você paga no mês independentemente de vender ou não. É a diferença entre "quanto sobra de
 * cada venda" e "a partir de quantas vendas eu paro de perder dinheiro".
 */

export interface FixedCostsInput {
  /** Aluguel, internet, assinaturas — o que vence todo mês mesmo sem vender nada. */
  monthlyFixedCost: number;
  /**
   * O DAS do MEI, quando o imposto está no modo valor fixo.
   *
   * Ele mora AQUI e não no preço unitário de propósito: somá-lo em cada unidade exigiria saber de
   * antemão quantas você vai vender, que é justamente a pergunta que esta conta responde. Rateá-lo
   * por um volume chutado embute o chute no preço e o esconde.
   */
  monthlyFixedTax: number;
}

export interface BreakEven {
  /** Custo fixo total do mês, já com o imposto fixo. */
  monthlyCost: number;
  /** O que cada venda deixa pra pagar o fixo. */
  contributionMargin: number;
  /**
   * Vendas necessárias só pra empatar. `null` quando a margem de contribuição é zero ou negativa:
   * aí nenhuma quantidade de vendas paga o fixo, e vender mais só aumenta o prejuízo. Devolver
   * "infinito" viraria um número na tela; devolver zero diria que já está empatado.
   */
  units: number | null;
  /** Faturamento correspondente, pra quem pensa em dinheiro e não em unidade. */
  revenue: number | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Sempre pra CIMA: 60,2 vendas não existem, e arredondar pra baixo deixaria o mês no vermelho por
 *  uma fração de venda. */
function unidadesInteiras(n: number): number {
  return Math.ceil(round2(n));
}

export function computeBreakEven(economics: UnitEconomics, fixed: FixedCostsInput): BreakEven {
  const monthlyCost = round2(Math.max(0, fixed.monthlyFixedCost) + Math.max(0, fixed.monthlyFixedTax));
  const contributionMargin = economics.contributionMargin;

  if (contributionMargin <= 0) {
    return { monthlyCost, contributionMargin, units: null, revenue: null };
  }

  const units = unidadesInteiras(monthlyCost / contributionMargin);
  return { monthlyCost, contributionMargin, units, revenue: round2(units * economics.price) };
}

export interface TargetResult extends BreakEven {
  targetProfit: number;
  /** Vendas pra chegar no lucro desejado — sempre ≥ o ponto de equilíbrio. */
  unitsForTarget: number | null;
  revenueForTarget: number | null;
  /** Quantas vendas depois do equilíbrio o lucro começa a aparecer. */
  unitsBeyondBreakEven: number | null;
}

/**
 * Quantas vendas pra chegar num lucro.
 *
 * **Com custo fixo, não é `meta ÷ lucro_unitário`** — essa conta responde "quantas vendas somam
 * esse valor" e ignora que o mês tem contas a pagar antes de qualquer lucro existir. O certo é
 * `(custo_fixo + meta) ÷ margem_de_contribuição`: primeiro você cobre o fixo, e só então começa a
 * ganhar. Com custo fixo zero as duas coincidem, que é o caso de quem não tem despesa mensal.
 */
export function unitsForTargetProfit(economics: UnitEconomics, fixed: FixedCostsInput, targetProfit: number): TargetResult {
  const base = computeBreakEven(economics, fixed);
  const meta = Math.max(0, targetProfit);

  if (base.contributionMargin <= 0) {
    return { ...base, targetProfit: meta, unitsForTarget: null, revenueForTarget: null, unitsBeyondBreakEven: null };
  }

  const unitsForTarget = unidadesInteiras((base.monthlyCost + meta) / base.contributionMargin);
  return {
    ...base,
    targetProfit: meta,
    unitsForTarget,
    revenueForTarget: round2(unitsForTarget * economics.price),
    unitsBeyondBreakEven: base.units === null ? null : unitsForTarget - base.units,
  };
}

export interface DiscountImpact {
  discountPercent: number;
  newPrice: number;
  newEconomics: UnitEconomics;
  /** Quanto do lucro foi embora, em reais e em % do lucro original. */
  profitLost: number;
  profitLostPercent: number;
  /** Quantas vendas a mais pra manter o mesmo lucro total de antes do desconto. */
  extraUnitsForSameProfit: number | null;
  /** O desconto passou do piso: cada venda dá prejuízo. */
  belowMinimum: boolean;
}

/**
 * O estrago de um desconto.
 *
 * **Desconto corrói o lucro muito mais do que parece**, porque ele sai inteiro de cima da margem:
 * 10% de desconto num produto com 30% de margem leva um terço do lucro embora, não 10%. Quem não
 * vê esse número dá desconto achando que perdeu 10%.
 */
export function discountImpact(
  input: Parameters<typeof computeUnitEconomics>[0],
  discountPercent: number,
): DiscountImpact {
  const original = computeUnitEconomics(input);
  const desconto = Math.min(100, Math.max(0, discountPercent));
  const newPrice = round2(original.price * (1 - desconto / 100));
  const newEconomics = computeUnitEconomics({ ...input, price: newPrice });

  const profitLost = round2(original.profit - newEconomics.profit);

  return {
    discountPercent: desconto,
    newPrice,
    newEconomics,
    profitLost,
    // Só faz sentido falar em "% do lucro perdido" quando havia lucro: com prejuízo antes do
    // desconto o número viraria uma porcentagem de um negativo, que não se lê.
    profitLostPercent: original.profit > 0 ? round2((profitLost / original.profit) * 100) : 0,
    extraUnitsForSameProfit:
      newEconomics.profit > 0 && original.profit > 0
        ? Math.ceil(round2(original.profit / newEconomics.profit)) - 1
        : null,
    belowMinimum: newEconomics.profit < 0,
  };
}
