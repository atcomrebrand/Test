import { dateForDayInMonth } from "../../../common/date/day-of-month";

export interface GenerateInstallmentsInput {
  purchaseDate: Date;
  closingDay: number;
  dueDay: number;
  installmentAmount: number;
  installmentsCount: number;
}

export interface GeneratedInstallment {
  number: number;
  amount: number;
  referenceMonth: number; // 1-12
  referenceYear: number;
  dueDate: Date;
  status?: "PENDING" | "PAID";
  paidAt?: Date | null;
  paidAmount?: number | null;
}

/**
 * Core billing-cycle engine, for a brand-new purchase.
 *
 * A purchase made on/before the card's closing day lands on the *current*
 * invoice; made after the closing day, it rolls to *next month*'s invoice.
 * From there, installment N simply advances N-1 months from that reference
 * invoice. Every installment charges the same fixed `installmentAmount` —
 * that's the number printed on the receipt ("10x de R$ 50"), not a total
 * that gets divided, so there's no rounding remainder to absorb.
 */
export function generateInstallments(input: GenerateInstallmentsInput): GeneratedInstallment[] {
  const { purchaseDate, closingDay, dueDay, installmentAmount, installmentsCount } = input;

  if (installmentsCount < 1) throw new Error("Número de parcelas deve ser ao menos 1.");
  if (installmentAmount <= 0) throw new Error("Valor da parcela deve ser maior que zero.");

  const firstReference = firstReferenceMonth(purchaseDate, closingDay);
  const amount = round2(installmentAmount);

  return Array.from({ length: installmentsCount }, (_, i) => {
    const { year, month } = addMonths(firstReference.year, firstReference.month, i);
    return {
      number: i + 1,
      amount,
      referenceMonth: month,
      referenceYear: year,
      dueDate: dateForDayInMonth(year, month, dueDay),
    };
  });
}

export interface GenerateInstallmentsInProgressInput {
  /** Due date of the next unpaid parcela. */
  nextDueDate: Date;
  installmentAmount: number;
  installmentsCount: number;
  /** How many parcelas, starting from #1, are already paid. */
  paidInstallmentsCount: number;
}

/**
 * Same engine as {@link generateInstallments}, but for an installment plan
 * that's already partway through outside this app (e.g. logging a purchase
 * you financed a few months ago). Instead of a purchase date + closing day,
 * `nextDueDate` anchors the first *unpaid* parcela directly, and the first
 * `paidInstallmentsCount` parcelas come back marked PAID.
 */
export function generateInstallmentsInProgress(input: GenerateInstallmentsInProgressInput): GeneratedInstallment[] {
  const { nextDueDate, installmentAmount, installmentsCount, paidInstallmentsCount } = input;

  if (installmentsCount < 1) throw new Error("Número de parcelas deve ser ao menos 1.");
  if (installmentAmount <= 0) throw new Error("Valor da parcela deve ser maior que zero.");
  if (paidInstallmentsCount < 0) throw new Error("Número de parcelas pagas não pode ser negativo.");
  if (paidInstallmentsCount >= installmentsCount) {
    throw new Error("Número de parcelas pagas deve ser menor que o número total de parcelas.");
  }

  const anchorNumber = paidInstallmentsCount + 1; // 1-based number of the parcela due on nextDueDate
  const day = nextDueDate.getDate();
  const amount = round2(installmentAmount);

  return Array.from({ length: installmentsCount }, (_, idx) => {
    const number = idx + 1;
    const { year, month } = addMonths(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, number - anchorNumber);
    const dueDate = dateForDayInMonth(year, month, day);
    const isPaid = number <= paidInstallmentsCount;

    return {
      number,
      amount,
      referenceMonth: month,
      referenceYear: year,
      dueDate,
      status: isPaid ? "PAID" : "PENDING",
      paidAt: isPaid ? dueDate : null,
      paidAmount: isPaid ? amount : null,
    };
  });
}

export interface GenerateRecurringOccurrencesInput {
  /** Due date of the next (or, for a brand-new subscription, the first) charge. */
  nextPaymentDate: Date;
  monthlyAmount: number;
  /** 1-based number of the first occurrence generated in this batch (>1 when topping up an existing subscription). */
  startNumber?: number;
  /** How many monthly occurrences to generate in this batch. */
  count: number;
}

/**
 * Recurring-subscription engine (Netflix, Spotify, etc.).
 *
 * Unlike a parceled purchase, each occurrence charges the *full* monthly
 * amount — nothing is split. Subscriptions aren't tied to the card's
 * closing-day invoice cycle: the user already knows exactly which day their
 * subscription bills every month, so `nextPaymentDate` anchors the schedule
 * directly instead of deriving it from a purchase date. Subscriptions are
 * open-ended, so callers generate a bounded batch (e.g. the next 6 months)
 * and top it up over time via `startNumber` instead of generating forever
 * up front.
 */
export function generateRecurringOccurrences(input: GenerateRecurringOccurrencesInput): GeneratedInstallment[] {
  const { nextPaymentDate, monthlyAmount, startNumber = 1, count } = input;

  if (monthlyAmount <= 0) throw new Error("Valor mensal deve ser maior que zero.");
  if (startNumber < 1) throw new Error("Número da primeira ocorrência deve ser ao menos 1.");
  if (count < 1) return [];

  const day = nextPaymentDate.getDate();
  const amount = round2(monthlyAmount);

  return Array.from({ length: count }, (_, i) => {
    const number = startNumber + i;
    const { year, month } = addMonths(nextPaymentDate.getFullYear(), nextPaymentDate.getMonth() + 1, number - 1);
    return {
      number,
      amount,
      referenceMonth: month,
      referenceYear: year,
      dueDate: dateForDayInMonth(year, month, day),
    };
  });
}

function firstReferenceMonth(purchaseDate: Date, closingDay: number): { year: number; month: number } {
  const day = purchaseDate.getDate();
  const referenceOffset = day <= closingDay ? 0 : 1;
  return addMonths(purchaseDate.getFullYear(), purchaseDate.getMonth() + 1, referenceOffset);
}

export function addMonths(year: number, month1to12: number, offset: number): { year: number; month: number } {
  const zeroBased = month1to12 - 1 + offset;
  const year2 = year + Math.floor(zeroBased / 12);
  const month2 = ((zeroBased % 12) + 12) % 12;
  return { year: year2, month: month2 + 1 };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
