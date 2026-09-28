export interface GenerateFixedInstallmentsInput {
  /** Due date of the next unpaid installment (or installment #1, if none have been paid yet). */
  nextDueDate: Date;
  installmentAmount: number;
  installmentsCount: number;
  /** How many installments, starting from #1, are already paid — 0 for a brand-new financing. */
  paidInstallmentsCount?: number;
}

export interface GeneratedFixedInstallment {
  number: number;
  amount: number;
  dueDate: Date;
  status: "PAID" | "PENDING";
  paidAt: Date | null;
  paidAmount: number | null;
}

/**
 * Financing engine (car/motorcycle/house). Unlike the credit-card engine,
 * there's no closing-day rule and no interest/amortization math — the
 * contract already states a fixed monthly payment, so we just repeat it
 * once a month for N months. Day-of-month is clamped for shorter months
 * (e.g. due day 31 becomes the 28th/30th in February/April), which matters
 * over financing terms that can run 20-35 years and cross many such months.
 *
 * A financing can be registered mid-course (already partially paid outside
 * this app): `paidInstallmentsCount` marks the first N installments as PAID
 * and anchors the schedule on `nextDueDate` — the due date of the first
 * *unpaid* installment — instead of requiring the user to know or re-derive
 * installment #1's original due date.
 */
export function generateFixedInstallments(input: GenerateFixedInstallmentsInput): GeneratedFixedInstallment[] {
  const { nextDueDate, installmentAmount, installmentsCount, paidInstallmentsCount = 0 } = input;

  if (installmentAmount <= 0) throw new Error("Valor da parcela deve ser maior que zero.");
  if (installmentsCount < 1) throw new Error("Número de parcelas deve ser ao menos 1.");
  if (paidInstallmentsCount < 0) throw new Error("Número de parcelas pagas não pode ser negativo.");
  if (paidInstallmentsCount >= installmentsCount) {
    throw new Error("Número de parcelas pagas deve ser menor que o número total de parcelas.");
  }

  const anchorNumber = paidInstallmentsCount + 1; // 1-based number of the installment due on nextDueDate
  const day = nextDueDate.getDate();
  const amount = Math.round(installmentAmount * 100) / 100;

  return Array.from({ length: installmentsCount }, (_, idx) => {
    const number = idx + 1;
    const targetMonthIndex = nextDueDate.getMonth() + (number - anchorNumber);
    const year = nextDueDate.getFullYear() + Math.floor(targetMonthIndex / 12);
    const month = ((targetMonthIndex % 12) + 12) % 12;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const clampedDay = Math.min(day, daysInMonth);
    const dueDate = new Date(year, month, clampedDay, 12, 0, 0);
    const isPaid = number <= paidInstallmentsCount;

    return {
      number,
      amount,
      dueDate,
      status: isPaid ? "PAID" : "PENDING",
      paidAt: isPaid ? dueDate : null,
      paidAmount: isPaid ? amount : null,
    };
  });
}
