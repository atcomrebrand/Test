export interface PreviewInstallment {
  number: number;
  amount: number;
  referenceMonth: number;
  referenceYear: number;
  dueDate: Date;
  status?: "PENDING" | "PAID";
}

/** Mirrors the backend's closing-day engine for a brand-new purchase (apps/api .../installment-generator.ts). */
export function previewInstallments(input: {
  purchaseDate: Date;
  closingDay: number;
  dueDay: number;
  installmentAmount: number;
  installmentsCount: number;
}): PreviewInstallment[] {
  const { purchaseDate, closingDay, dueDay, installmentAmount, installmentsCount } = input;
  if (!installmentAmount || installmentAmount <= 0 || installmentsCount < 1 || Number.isNaN(purchaseDate.getTime())) return [];

  const day = purchaseDate.getDate();
  const referenceOffset = day <= closingDay ? 0 : 1;
  const first = addMonths(purchaseDate.getFullYear(), purchaseDate.getMonth() + 1, referenceOffset);
  const amount = Math.round(installmentAmount * 100) / 100;

  return Array.from({ length: installmentsCount }, (_, i) => {
    const { year, month } = addMonths(first.year, first.month, i);
    return {
      number: i + 1,
      amount,
      referenceMonth: month,
      referenceYear: year,
      dueDate: dateForDayInMonth(year, month, dueDay),
    };
  });
}

/** Mirrors the backend's in-progress engine: anchored directly on the next unpaid parcela's due date, first N marked paid. */
export function previewInstallmentsInProgress(input: {
  nextDueDate: Date;
  installmentAmount: number;
  installmentsCount: number;
  paidInstallmentsCount: number;
}): PreviewInstallment[] {
  const { nextDueDate, installmentAmount, installmentsCount, paidInstallmentsCount } = input;
  if (!installmentAmount || installmentAmount <= 0 || installmentsCount < 1 || Number.isNaN(nextDueDate.getTime())) return [];
  if (paidInstallmentsCount < 0 || paidInstallmentsCount >= installmentsCount) return [];

  const anchorNumber = paidInstallmentsCount + 1;
  const day = nextDueDate.getDate();
  const amount = Math.round(installmentAmount * 100) / 100;

  return Array.from({ length: installmentsCount }, (_, idx) => {
    const number = idx + 1;
    const { year, month } = addMonths(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, number - anchorNumber);
    return {
      number,
      amount,
      referenceMonth: month,
      referenceYear: year,
      dueDate: dateForDayInMonth(year, month, day),
      status: number <= paidInstallmentsCount ? "PAID" : "PENDING",
    };
  });
}

/** Mirrors the backend's subscription engine: anchored directly on the next payment date, no closing day involved. */
export function previewRecurringOccurrence(input: { nextPaymentDate: Date; monthlyAmount: number }): PreviewInstallment | null {
  const { nextPaymentDate, monthlyAmount } = input;
  if (!monthlyAmount || monthlyAmount <= 0 || Number.isNaN(nextPaymentDate.getTime())) return null;

  return {
    number: 1,
    amount: Math.round(monthlyAmount * 100) / 100,
    referenceMonth: nextPaymentDate.getMonth() + 1,
    referenceYear: nextPaymentDate.getFullYear(),
    dueDate: nextPaymentDate,
  };
}

function addMonths(year: number, month1to12: number, offset: number) {
  const zeroBased = month1to12 - 1 + offset;
  const year2 = year + Math.floor(zeroBased / 12);
  const month2 = ((zeroBased % 12) + 12) % 12;
  return { year: year2, month: month2 + 1 };
}

/** A Date for `day` within the given month (1-based), clamped to that month's real length (e.g. day 31 in Feb -> 28/29). */
function dateForDayInMonth(year: number, month1to12: number, day: number): Date {
  const daysInMonth = new Date(year, month1to12, 0).getDate();
  return new Date(year, month1to12 - 1, Math.min(day, daysInMonth));
}
