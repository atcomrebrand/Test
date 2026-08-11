/**
 * Dinheiro: taxa, líquido, churn, retenção e VIP.
 *
 * A taxa é copiada pra linha do pagamento no momento em que ele acontece, e é aqui que ela é
 * calculada. Mudar a taxa do PIX amanhã não pode reescrever o líquido de ontem — o mesmo princípio
 * que congela o preço do crédito na recarga.
 */

export interface FeeConfig {
  feePercent: number;
  feeFixed: number;
}

export interface FeeSplit {
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
}

/** Arredonda pra centavo. Sem isso a taxa percentual vaza casas decimais pro banco. */
function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Bruto → taxa → líquido. A taxa percentual incide sobre o bruto e a fixa se soma depois, que é
 * como as maquininhas e gateways cobram de fato.
 */
export function splitPaymentFee(grossAmount: number, { feePercent, feeFixed }: FeeConfig): FeeSplit {
  const gross = toCents(grossAmount);
  const feeAmount = toCents(gross * (feePercent / 100) + feeFixed);

  // Taxa maior que o valor deixaria o líquido negativo. Acontece de verdade em cobrança pequena com
  // taxa fixa alta, e o número correto é o negativo mesmo — esconder faria a receita não fechar.
  return { grossAmount: gross, feeAmount, netAmount: toCents(gross - feeAmount) };
}

export interface ChurnInput {
  /** Clientes ativos no início do período. */
  startActive: number;
  /** Clientes que cancelaram/não renovaram dentro do período. */
  lost: number;
  /** Clientes novos no período. */
  gained: number;
}

export interface ChurnResult {
  lost: number;
  gained: number;
  /** Novos menos perdidos. Pode ser negativo — é o ponto do indicador. */
  netGrowth: number;
  /** Perdidos ÷ base inicial, em %. Null quando não havia base — 0% mentiria. */
  churnRate: number | null;
  growthRate: number | null;
}

export function computeChurn({ startActive, lost, gained }: ChurnInput): ChurnResult {
  return {
    lost,
    gained,
    netGrowth: gained - lost,
    // Sem base inicial não existe taxa: 3 cancelamentos sobre 0 clientes não é 0% nem 100%.
    churnRate: startActive > 0 ? toCents((lost / startActive) * 100) : null,
    growthRate: startActive > 0 ? toCents(((gained - lost) / startActive) * 100) : null,
  };
}

export interface CohortMember {
  /** Quando virou cliente. */
  startedAt: Date;
  /** Quando saiu, ou null se ainda está ativo. */
  endedAt: Date | null;
}

export interface RetentionPoint {
  months: number;
  /** Quantos tiveram tempo suficiente pra alcançar esse marco. */
  eligible: number;
  retained: number;
  /** Null quando ninguém ainda alcançou o marco — não é 0%. */
  rate: number | null;
}

const RETENTION_MILESTONES = [1, 3, 6, 12, 24];

/**
 * Retenção por tempo (§26). O detalhe que faz o número ser honesto: quem entrou mês passado não
 * conta no marco de 12 meses. Sem esse recorte de elegibilidade, todo cliente novo derruba a
 * retenção de longo prazo e o gráfico vira ruído.
 */
export function computeRetentionCohorts(members: readonly CohortMember[], today: Date): RetentionPoint[] {
  const monthsBetween = (from: Date, to: Date) =>
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth()) -
    (to.getUTCDate() < from.getUTCDate() ? 1 : 0);

  return RETENTION_MILESTONES.map((months) => {
    let eligible = 0;
    let retained = 0;

    for (const m of members) {
      if (monthsBetween(m.startedAt, today) < months) continue;
      eligible += 1;
      const survivedMonths = monthsBetween(m.startedAt, m.endedAt ?? today);
      if (survivedMonths >= months) retained += 1;
    }

    return { months, eligible, retained, rate: eligible > 0 ? toCents((retained / eligible) * 100) : null };
  });
}

export interface VipCriteria {
  minMonths?: number | null;
  minRevenue?: number | null;
  minRenewals?: number | null;
}

export interface VipInput {
  monthsAsCustomer: number;
  totalRevenue: number;
  renewals: number;
  /** Marcado à mão: o cálculo nunca desmarca quem foi promovido manualmente. */
  vipManual?: boolean;
}

/**
 * VIP (§27). Critérios são OU, não E: quem gerou muita receita é VIP mesmo sendo cliente há pouco,
 * e quem está há anos é VIP mesmo pagando pouco. Exigir todos de uma vez zeraria a lista.
 */
export function classifyVip(input: VipInput, criteria: VipCriteria): boolean {
  if (input.vipManual) return true;

  const checks = [
    criteria.minMonths != null && input.monthsAsCustomer >= criteria.minMonths,
    criteria.minRevenue != null && input.totalRevenue >= criteria.minRevenue,
    criteria.minRenewals != null && input.renewals >= criteria.minRenewals,
  ];

  return checks.some(Boolean);
}

export interface RevenueBreakdown {
  /** Receita de clientes diretos. */
  direct: number;
  /** Receita de recargas de revendedor. */
  reseller: number;
  total: number;
}

/**
 * As duas origens sempre aparecem juntas com o total (§55) — nunca só o total. Um número só faria
 * parecer que R$ 12.300 vieram do mesmo lugar, quando metade é assinatura e metade é crédito.
 */
export function combineRevenue(direct: number, reseller: number): RevenueBreakdown {
  return { direct: toCents(direct), reseller: toCents(reseller), total: toCents(direct + reseller) };
}

export function averageTicket(total: number, count: number): number | null {
  return count > 0 ? toCents(total / count) : null;
}
