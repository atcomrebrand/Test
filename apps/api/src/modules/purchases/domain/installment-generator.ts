export interface GenerateInstallmentsInput {
  purchaseDate: Date;
  closingDay: number;
  dueDay: number;
  totalAmount: number;
  installmentsCount: number;
  downPayment?: number;
}

export interface GeneratedInstallment {
  number: number;
  amount: number;
  referenceMonth: number; // 1-12
  referenceYear: number;
  dueDate: Date;
}

/**
 * Core billing-cycle engine.
 *
 * A purchase made on/before the card's closing day lands on the *current*
 * invoice; made after the closing day, it rolls to *next month*'s invoice.
 * From there, installment N simply advances N-1 months from that reference
 * invoice. Amounts are split evenly with the rounding remainder absorbed by
 * the last installment, so the sum always equals the financed total exactly
 * (never more, never less) — this is a hard invariant of the product.
 */
export function generateInstallments(input: GenerateInstallmentsInput): GeneratedInstallment[] {
  const { purchaseDate, closingDay, dueDay, totalAmount, installmentsCount, downPayment = 0 } = input;

  if (installmentsCount < 1) throw new Error("Número de parcelas deve ser ao menos 1.");
  if (totalAmount <= 0) throw new Error("Valor total deve ser maior que zero.");
  if (downPayment < 0) throw new Error("Entrada não pode ser negativa.");
  if (downPayment >= totalAmount) throw new Error("Entrada não pode ser maior ou igual ao valor total.");

  const financedAmount = round2(totalAmount - downPayment);

  const day = purchaseDate.getDate();
  const referenceOffset = day <= closingDay ? 0 : 1;
  const firstReference = addMonths(purchaseDate.getFullYear(), purchaseDate.getMonth() + 1, referenceOffset);

  const baseAmountCents = Math.floor((financedAmount * 100) / installmentsCount);
  const remainderCents = Math.round(financedAmount * 100) - baseAmountCents * installmentsCount;

  const installments: GeneratedInstallment[] = [];

  for (let i = 0; i < installmentsCount; i++) {
    const { year, month } = addMonths(firstReference.year, firstReference.month, i);
    const isLast = i === installmentsCount - 1;
    const amountCents = baseAmountCents + (isLast ? remainderCents : 0);

    installments.push({
      number: i + 1,
      amount: amountCents / 100,
      referenceMonth: month,
      referenceYear: year,
      dueDate: new Date(year, month - 1, dueDay, 12, 0, 0),
    });
  }

  return installments;
}

function addMonths(year: number, month1to12: number, offset: number): { year: number; month: number } {
  const zeroBased = month1to12 - 1 + offset;
  const year2 = year + Math.floor(zeroBased / 12);
  const month2 = ((zeroBased % 12) + 12) % 12;
  return { year: year2, month: month2 + 1 };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
