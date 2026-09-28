/**
 * Estoque próprio de créditos — o que você compra do painel de cima e gasta renovando cliente.
 *
 * É um segundo estoque, independente do crédito do revendedor. A diferença que importa: o crédito
 * do revendedor é **receita** (ele compra de você), o crédito do painel é **custo** (você compra de
 * quem está acima). Somar os dois inverteria o sinal do lucro, e por isso eles nem compartilham
 * tabela.
 */

export type CrmCurrency = "BRL" | "USD";

export interface PanelMovement {
  quantity: number;
  createdAt: Date;
}

export interface PanelRechargeForCost {
  quantity: number;
  totalAmount: number;
}

/** Saldo do estoque: soma do extrato, como em todo lugar deste módulo. */
export function computePanelBalance(movements: readonly PanelMovement[]): number {
  return movements.reduce((sum, m) => sum + m.quantity, 0);
}

/**
 * Custo em créditos de uma renovação (§ decisão: vem do pacote).
 *
 * A assinatura pode sobrescrever o plano — existe cliente com combinado diferente —, e a última
 * defesa é 1, porque uma renovação sempre consome alguma coisa: devolver 0 faria o estoque nunca
 * baixar e o saldo mentir pra sempre.
 */
export function resolveCreditCost(
  subscriptionCost: number | null | undefined,
  planCost: number | null | undefined,
): number {
  if (subscriptionCost != null && subscriptionCost > 0) return subscriptionCost;
  if (planCost != null && planCost > 0) return planCost;
  return 1;
}

export interface CreditAvailability {
  balance: number;
  required: number;
  enough: boolean;
  missing: number;
}

/**
 * Checagem feita antes de gravar a renovação. Bloquear é decisão do usuário: prefere descobrir na
 * hora que falta crédito a acabar com um saldo negativo que não corresponde ao painel de verdade.
 */
export function checkCreditAvailability(balance: number, required: number): CreditAvailability {
  const missing = Math.max(0, required - balance);
  return { balance, required, enough: missing === 0, missing };
}

/**
 * Preço médio pago por crédito, ponderado pela quantidade de cada compra.
 *
 * Ponderado e não média simples: quem comprou 1000 créditos a R$ 0,90 e 10 a R$ 2,00 pagou perto de
 * R$ 0,91, não R$ 1,45. É esse número que multiplica o consumo pra virar custo.
 */
export function averagePanelCreditPrice(recharges: readonly PanelRechargeForCost[]): number | null {
  const credits = recharges.reduce((s, r) => s + r.quantity, 0);
  if (credits <= 0) return null;
  const spent = recharges.reduce((s, r) => s + r.totalAmount, 0);
  return Math.round((spent / credits) * 10000) / 10000;
}

export interface ProfitInput {
  /** Receita bruta no período, na moeda do serviço. */
  grossRevenue: number;
  /** Taxas de pagamento já retidas. */
  fees: number;
  /** Créditos consumidos no período. */
  creditsConsumed: number;
  /** Preço médio pago por crédito. Null = nunca houve compra, então o custo é desconhecido. */
  averageCreditPrice: number | null;
}

export interface ProfitResult {
  grossRevenue: number;
  fees: number;
  creditCost: number;
  /** Receita − taxas − custo dos créditos. */
  profit: number;
  /** Margem sobre o bruto, em %. Null quando não houve receita. */
  margin: number | null;
  /** True quando o custo não pôde ser apurado — a margem então está otimista. */
  costUnknown: boolean;
}

/**
 * Lucro real: o que sobra depois da taxa do pagamento e do que o crédito custou.
 *
 * Sem preço médio o custo entra como zero, mas `costUnknown` avisa — mostrar margem cheia sem dizer
 * que o custo ficou de fora é o tipo de número que faz decidir errado.
 */
export function computeProfit({ grossRevenue, fees, creditsConsumed, averageCreditPrice }: ProfitInput): ProfitResult {
  const round = (v: number) => Math.round(v * 100) / 100;
  const costUnknown = averageCreditPrice === null && creditsConsumed > 0;
  const creditCost = round((averageCreditPrice ?? 0) * creditsConsumed);
  const profit = round(grossRevenue - fees - creditCost);

  return {
    grossRevenue: round(grossRevenue),
    fees: round(fees),
    creditCost,
    profit,
    margin: grossRevenue > 0 ? round((profit / grossRevenue) * 100) : null,
    costUnknown,
  };
}

export interface CurrencyBucket {
  currency: CrmCurrency;
  direct: number;
  reseller: number;
  total: number;
}

/**
 * Agrupa receita por moeda (§ decisão: nunca somar real com dólar).
 *
 * Devolve uma entrada por moeda presente, em vez de um total único. É a mesma regra do churn de
 * "Todos": um número que junta grandezas diferentes parece preciso e não significa nada.
 */
export function groupRevenueByCurrency(
  rows: readonly { currency: CrmCurrency; direct: number; reseller: number }[],
): CurrencyBucket[] {
  const byCurrency = new Map<CrmCurrency, CurrencyBucket>();

  for (const row of rows) {
    const bucket = byCurrency.get(row.currency) ?? {
      currency: row.currency,
      direct: 0,
      reseller: 0,
      total: 0,
    };
    bucket.direct += row.direct;
    bucket.reseller += row.reseller;
    bucket.total += row.direct + row.reseller;
    byCurrency.set(row.currency, bucket);
  }

  const round = (v: number) => Math.round(v * 100) / 100;
  // BRL primeiro: é a moeda de casa, e a ordem estável evita a tela trocar de lugar entre visitas.
  return [...byCurrency.values()]
    .map((b) => ({ ...b, direct: round(b.direct), reseller: round(b.reseller), total: round(b.total) }))
    .sort((a, b) => (a.currency === "BRL" ? -1 : b.currency === "BRL" ? 1 : 0));
}
