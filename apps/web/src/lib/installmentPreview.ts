export interface PreviewInstallment {
  number: number;
  amount: number;
  referenceMonth: number;
  referenceYear: number;
  dueDate: Date;
}

/** Mirrors the backend's closing-day engine (apps/api .../installment-generator.ts) for instant UI feedback. */
export function previewInstallments(input: {
  purchaseDate: Date;
  closingDay: number;
  dueDay: number;
  totalAmount: number;
  installmentsCount: number;
  downPayment?: number;
}): PreviewInstallment[] {
  const { purchaseDate, closingDay, dueDay, totalAmount, installmentsCount, downPayment = 0 } = input;
  if (!totalAmount || totalAmount <= 0 || installmentsCount < 1 || Number.isNaN(purchaseDate.getTime())) return [];
  if (downPayment >= totalAmount) return [];

  const financedAmount = Math.round((totalAmount - downPayment) * 100) / 100;
  const day = purchaseDate.getDate();
  const referenceOffset = day <= closingDay ? 0 : 1;
  const first = addMonths(purchaseDate.getFullYear(), purchaseDate.getMonth() + 1, referenceOffset);

  const baseCents = Math.floor((financedAmount * 100) / installmentsCount);
  const remainderCents = Math.round(financedAmount * 100) - baseCents * installmentsCount;

  return Array.from({ length: installmentsCount }, (_, i) => {
    const { year, month } = addMonths(first.year, first.month, i);
    const isLast = i === installmentsCount - 1;
    return {
      number: i + 1,
      amount: (baseCents + (isLast ? remainderCents : 0)) / 100,
      referenceMonth: month,
      referenceYear: year,
      dueDate: new Date(year, month - 1, dueDay),
    };
  });
}

function addMonths(year: number, month1to12: number, offset: number) {
  const zeroBased = month1to12 - 1 + offset;
  const year2 = year + Math.floor(zeroBased / 12);
  const month2 = ((zeroBased % 12) + 12) % 12;
  return { year: year2, month: month2 + 1 };
}
