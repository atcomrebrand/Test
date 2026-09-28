/**
 * Créditos do revendedor (§31, §33).
 *
 * A regra central: o saldo é a soma das movimentações, nunca um número guardado. Guardar o saldo
 * numa coluna significa ter duas fontes de verdade que divergem no primeiro erro de transação — e
 * aí não dá mais pra saber qual das duas está certa. Aqui a coluna simplesmente não existe.
 *
 * Corolário: movimentação não se apaga nem se edita. Erro se corrige com um ADJUSTMENT contrário,
 * que fica visível no extrato. O extrato é o registro do que aconteceu, não do que deveria ter
 * acontecido.
 */

export type CrmCreditMovementKind = "RECHARGE" | "USAGE" | "ADJUSTMENT";

export interface CreditMovement {
  kind: CrmCreditMovementKind;
  /** Assinado: positivo entra, negativo sai. */
  quantity: number;
  createdAt: Date;
}

export interface CreditSummary {
  balance: number;
  /** Total que já entrou (recargas + ajustes positivos). */
  purchased: number;
  /** Total que já saiu, sempre positivo. */
  used: number;
}

export function computeCreditBalance(movements: readonly CreditMovement[]): number {
  return movements.reduce((sum, m) => sum + m.quantity, 0);
}

export function summarizeCredits(movements: readonly CreditMovement[]): CreditSummary {
  let purchased = 0;
  let used = 0;
  for (const m of movements) {
    if (m.quantity >= 0) purchased += m.quantity;
    else used += -m.quantity;
  }
  return { balance: purchased - used, purchased, used };
}

/**
 * Normaliza o que a UI manda pra uma movimentação assinada. USAGE sempre sai, RECHARGE sempre
 * entra, e só ADJUSTMENT respeita o sinal — é justamente o tipo que existe pra corrigir os outros
 * dois nas duas direções.
 */
export function signedQuantity(kind: CrmCreditMovementKind, quantity: number): number {
  const magnitude = Math.abs(quantity);
  if (kind === "USAGE") return -magnitude;
  if (kind === "RECHARGE") return magnitude;
  return quantity;
}

export interface LowCreditInput {
  balance: number;
  threshold: number;
}

export function isLowCredit({ balance, threshold }: LowCreditInput): boolean {
  return balance <= threshold;
}

export type ResellerActivity = "ACTIVE" | "ATTENTION" | "INACTIVE";

export interface ResellerActivityInput {
  lastRechargeAt: Date | null;
  today: Date;
  attentionDays: number;
  inactiveDays: number;
}

/**
 * Semáforo de atividade (§39). Revendedor que nunca recarregou é INACTIVE, não ACTIVE: um cadastro
 * recém-criado sem nenhuma compra não é sinal verde — é exatamente quem precisa de contato.
 */
export function classifyResellerActivity({
  lastRechargeAt,
  today,
  attentionDays,
  inactiveDays,
}: ResellerActivityInput): { activity: ResellerActivity; daysSinceLastRecharge: number | null } {
  if (!lastRechargeAt) return { activity: "INACTIVE", daysSinceLastRecharge: null };

  const days = Math.floor((today.getTime() - lastRechargeAt.getTime()) / 86_400_000);
  if (days >= inactiveDays) return { activity: "INACTIVE", daysSinceLastRecharge: days };
  if (days >= attentionDays) return { activity: "ATTENTION", daysSinceLastRecharge: days };
  return { activity: "ACTIVE", daysSinceLastRecharge: days };
}

export interface RechargeStats {
  totalRecharges: number;
  totalCreditsPurchased: number;
  totalSpent: number;
  /** Total gasto ÷ créditos comprados. Null quando não houve compra — não é zero, é indefinido. */
  averageCreditPrice: number | null;
  /** Média de recargas por mês desde o início da relação. */
  rechargesPerMonth: number | null;
  creditsPerMonth: number | null;
}

export interface RechargeForStats {
  quantity: number;
  totalAmount: number;
}

export function summarizeRecharges(
  recharges: readonly RechargeForStats[],
  monthsAsReseller: number,
): RechargeStats {
  const totalRecharges = recharges.length;
  const totalCreditsPurchased = recharges.reduce((s, r) => s + r.quantity, 0);
  const totalSpent = recharges.reduce((s, r) => s + r.totalAmount, 0);

  // Meses conta a partir de 1: quem entrou esse mês tem "1 recarga por mês", não infinitas.
  const months = Math.max(1, monthsAsReseller);

  return {
    totalRecharges,
    totalCreditsPurchased,
    totalSpent,
    averageCreditPrice: totalCreditsPurchased > 0 ? totalSpent / totalCreditsPurchased : null,
    rechargesPerMonth: totalRecharges > 0 ? totalRecharges / months : null,
    creditsPerMonth: totalCreditsPurchased > 0 ? totalCreditsPurchased / months : null,
  };
}
