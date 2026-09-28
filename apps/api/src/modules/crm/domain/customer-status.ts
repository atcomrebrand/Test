/**
 * Status do cliente (§8 do briefing): calculado, não digitado.
 *
 * A razão de não gravar o status é que ele envelhece sozinho — "ativo" continuaria ativo no banco
 * no dia seguinte ao vencimento sem ninguém ter mexido em nada. O que a gente grava é o
 * `currentDueDate`, que é um fato, e derivamos o status dele a cada leitura.
 *
 * As únicas exceções são CANCELLED, INACTIVE e RECOVERY: atos deliberados de quem opera, que o
 * cálculo não tem como adivinhar e não deve sobrescrever.
 */

export type CrmCustomerStatus =
  | "LEAD"
  | "TRIAL"
  | "ACTIVE"
  | "DUE_SOON"
  | "LATE"
  | "DELINQUENT"
  | "CANCELLED"
  | "INACTIVE"
  | "RECOVERY";

/** Status que só existem por decisão de quem opera — nunca são inferidos. */
const MANUAL_ONLY: readonly CrmCustomerStatus[] = ["CANCELLED", "INACTIVE", "RECOVERY"];

/** A partir de quantos dias de atraso o cliente deixa de estar "em atraso" e vira "inadimplente". */
export const DELINQUENT_AFTER_DAYS = 7;

/** Janela de "vencendo": o cliente ainda está em dia, mas já entra na fila de cobrança. */
export const DUE_SOON_WITHIN_DAYS = 3;

export interface CustomerStatusInput {
  /** Vencimento vigente. Nulo = nunca assinou. */
  currentDueDate: Date | null;
  /** CANCELLED/INACTIVE/RECOVERY gravados no cliente. Vencem qualquer cálculo. */
  manualStatus?: CrmCustomerStatus | null;
  /** Fim do período de teste, quando houver. */
  trialEndsAt?: Date | null;
  /** Já teve ao menos uma assinatura? Separa "lead que nunca pagou" de "cliente sem assinatura". */
  hasEverSubscribed?: boolean;
  today: Date;
}

export interface CustomerStatusResult {
  status: CrmCustomerStatus;
  /** Positivo = faltam N dias; negativo = venceu há N dias; null = sem vencimento. */
  daysUntilDue: number | null;
  /** Dias de atraso, 0 quando em dia. Sempre positivo — evita `-daysUntilDue` espalhado na UI. */
  daysLate: number;
}

/** Diferença em dias inteiros de calendário, ignorando hora. */
export function diffInDays(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

export function computeCustomerStatus(input: CustomerStatusInput): CustomerStatusResult {
  const { currentDueDate, manualStatus, trialEndsAt, hasEverSubscribed, today } = input;

  const daysUntilDue = currentDueDate ? diffInDays(today, currentDueDate) : null;
  const daysLate = daysUntilDue !== null && daysUntilDue < 0 ? -daysUntilDue : 0;

  // O override manual vence tudo, inclusive um vencimento futuro: cancelar um cliente que pagou
  // até o fim do mês é exatamente o caso normal, e o cálculo não pode "descancelar" ele.
  if (manualStatus && MANUAL_ONLY.includes(manualStatus)) {
    return { status: manualStatus, daysUntilDue, daysLate };
  }

  // Teste em andamento vem antes do vencimento: durante o teste não existe cobrança em atraso.
  if (trialEndsAt && diffInDays(today, trialEndsAt) >= 0) {
    return { status: "TRIAL", daysUntilDue, daysLate };
  }

  if (daysUntilDue === null) {
    return { status: hasEverSubscribed ? "INACTIVE" : "LEAD", daysUntilDue, daysLate };
  }

  if (daysLate > DELINQUENT_AFTER_DAYS) return { status: "DELINQUENT", daysUntilDue, daysLate };
  if (daysLate > 0) return { status: "LATE", daysUntilDue, daysLate };
  if (daysUntilDue <= DUE_SOON_WITHIN_DAYS) return { status: "DUE_SOON", daysUntilDue, daysLate };
  return { status: "ACTIVE", daysUntilDue, daysLate };
}

/** Status que contam como "cliente ativo" nos indicadores. Vencendo ainda está em dia. */
export const ACTIVE_STATUSES: readonly CrmCustomerStatus[] = ["ACTIVE", "DUE_SOON", "TRIAL"];

export function isActiveStatus(status: CrmCustomerStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}
