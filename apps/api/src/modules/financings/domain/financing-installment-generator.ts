export interface GenerateFixedInstallmentsInput {
  firstDueDate: Date;
  installmentAmount: number;
  installmentsCount: number;
}

export interface GeneratedFixedInstallment {
  number: number;
  amount: number;
  dueDate: Date;
}

/**
 * Financing engine (car/motorcycle/house). Unlike the credit-card engine,
 * there's no closing-day rule and no interest/amortization math — the
 * contract already states a fixed monthly payment, so we just repeat it
 * once a month for N months starting from the first due date. Day-of-month
 * is clamped for shorter months (e.g. due day 31 becomes the 28th/30th in
 * February/April), which matters over financing terms that can run 20-35
 * years and cross many such months.
 */
export function generateFixedInstallments(input: GenerateFixedInstallmentsInput): GeneratedFixedInstallment[] {
  const { firstDueDate, installmentAmount, installmentsCount } = input;

  if (installmentAmount <= 0) throw new Error("Valor da parcela deve ser maior que zero.");
  if (installmentsCount < 1) throw new Error("Número de parcelas deve ser ao menos 1.");

  const day = firstDueDate.getDate();
  const amount = Math.round(installmentAmount * 100) / 100;

  return Array.from({ length: installmentsCount }, (_, i) => {
    const targetMonthIndex = firstDueDate.getMonth() + i;
    const year = firstDueDate.getFullYear() + Math.floor(targetMonthIndex / 12);
    const month = ((targetMonthIndex % 12) + 12) % 12;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const clampedDay = Math.min(day, daysInMonth);

    return {
      number: i + 1,
      amount,
      dueDate: new Date(year, month, clampedDay, 12, 0, 0),
    };
  });
}
