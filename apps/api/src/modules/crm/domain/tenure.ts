/**
 * Tempo como cliente (§10) e o próximo vencimento de uma renovação (§15).
 *
 * Os dois vivem juntos porque compartilham a mesma armadilha: aritmética de mês em JS estoura
 * silenciosamente. `new Date(2026, 0, 31)` + 1 mês vira 2 de março, não 28 de fevereiro — e num
 * CRM de assinatura isso significa cobrar o cliente no dia errado todo mês a partir de janeiro.
 */

import { diffInDays } from "./customer-status";

export type CrmBillingPeriod = "MONTHLY" | "BIMONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "CUSTOM";

const MONTHS_BY_PERIOD: Record<Exclude<CrmBillingPeriod, "CUSTOM">, number> = {
  MONTHLY: 1,
  BIMONTHLY: 2,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
};

export function monthsInPeriod(period: CrmBillingPeriod): number | null {
  return period === "CUSTOM" ? null : MONTHS_BY_PERIOD[period];
}

/**
 * Soma meses preservando o dia do mês, clampando no último dia quando o mês de destino é mais
 * curto. 31/01 + 1 mês = 28/02 (ou 29 em bissexto), e não 03/03.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  const targetMonth = month + months;
  // Dia 0 do mês seguinte = último dia do mês alvo.
  const lastDayOfTarget = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();

  return new Date(Date.UTC(year, targetMonth, Math.min(day, lastDayOfTarget)));
}

export function addDays(date: Date, days: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days),
  );
}

export interface NextDueDateInput {
  /** Vencimento atual da assinatura. */
  currentDueDate: Date;
  period: CrmBillingPeriod;
  /** Obrigatório quando period = CUSTOM. */
  customDays?: number | null;
  /**
   * Data em que a renovação está sendo registrada. Usada só pra decidir a âncora: quem renova
   * um plano vencido há meses não deve ganhar um vencimento ainda no passado.
   */
  today: Date;
}

/**
 * O próximo vencimento parte do vencimento atual — é o que mantém o ciclo ancorado no mesmo dia do
 * mês, renovação após renovação. A exceção é o cliente que voltou depois de sumir: se somar o
 * período ao vencimento antigo ainda cair no passado, a âncora vira hoje, senão a renovação
 * nasceria vencida e o cliente reapareceria como inadimplente no instante em que pagou.
 */
export function computeNextDueDate({ currentDueDate, period, customDays, today }: NextDueDateInput): Date {
  const months = monthsInPeriod(period);

  const advance = (from: Date) => {
    if (months !== null) return addMonthsClamped(from, months);
    const days = customDays && customDays > 0 ? customDays : 30;
    return addDays(from, days);
  };

  const fromCurrent = advance(currentDueDate);
  if (diffInDays(today, fromCurrent) >= 0) return fromCurrent;
  return advance(today);
}

export interface Tenure {
  days: number;
  months: number;
  years: number;
  /** Meses completos além dos anos inteiros — pro rótulo "2 anos e 4 meses". */
  remainingMonths: number;
  /** Rótulo pronto em português. */
  label: string;
}

/** Meses completos entre duas datas: 11/01 → 10/02 ainda é 0, porque o dia não fechou. */
export function fullMonthsBetween(from: Date, to: Date): number {
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) {
    // Só desconta se o dia de origem existe no mês de destino. Assinou 31/01 e hoje é 28/02: o mês
    // fechou, porque não existe 31 de fevereiro — descontar aqui deixaria o cliente eternamente
    // com "0 meses" todo fevereiro.
    const lastDayOfTo = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 0)).getUTCDate();
    if (from.getUTCDate() <= lastDayOfTo) months -= 1;
  }
  return Math.max(0, months);
}

export function computeTenure(since: Date | null, today: Date): Tenure | null {
  if (!since) return null;

  const days = Math.max(0, diffInDays(since, today));
  const months = fullMonthsBetween(since, today);
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  let label: string;
  if (years > 0 && remainingMonths > 0) {
    label = `${years} ano${years > 1 ? "s" : ""} e ${remainingMonths} ${remainingMonths > 1 ? "meses" : "mês"}`;
  } else if (years > 0) {
    label = `${years} ano${years > 1 ? "s" : ""}`;
  } else if (months > 0) {
    label = `${months} ${months > 1 ? "meses" : "mês"}`;
  } else {
    label = `${days} dia${days === 1 ? "" : "s"}`;
  }

  return { days, months, years, remainingMonths, label };
}
