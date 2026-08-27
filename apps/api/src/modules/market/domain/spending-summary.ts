export interface SpendingEntry {
  /** ISO yyyy-mm-dd. */
  purchaseDate: string;
  totalAmount: number;
  /** Lei 12.741/2012 approximate tax, or null for a nota that didn't disclose one. */
  taxAmount: number | null;
}

export interface MonthlySpending {
  /** yyyy-mm. */
  month: string;
  totalSpent: number;
  totalTax: number;
  purchaseCount: number;
  /** How many of the month's purchases carried a tax figure — the denominator behind totalTax. */
  purchasesWithTax: number;
  /** O mesmo critério do total: medido só sobre as notas do mês que declararam tributo, nunca
   *  `totalTax / totalSpent`. Null quando nenhuma nota do mês declarou. */
  taxSharePercent: number | null;
}

export interface SpendingSummary {
  totalSpent: number;
  /** Sum of the disclosed tax figures only. Purchases without one contribute nothing, so this is a
   *  floor, not an estimate of the tax on everything bought. */
  totalTax: number;
  /** totalTax over the spend of the purchases that actually disclosed tax — the effective rate as
   *  measured, rather than totalTax/totalSpent, which would be diluted by the purchases that had no
   *  figure at all. Null when nothing disclosed tax. */
  taxSharePercent: number | null;
  purchaseCount: number;
  purchasesWithTax: number;
  /** Oldest month first, with no gaps filled in — a month with no purchases simply isn't there. */
  byMonth: MonthlySpending[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Rolls grocery purchases up into what the user actually asked to see: how much was spent, and how
 * much of it was tax.
 *
 * The tax side is deliberately kept honest about its own coverage. Notas disclose the Lei 12.741
 * figure inconsistently — an older nota, or one from a store whose ERP omits the line, simply has
 * no value — and quietly summing what exists while dividing by everything spent would report a tax
 * rate lower than reality and give no hint that it's incomplete. So purchasesWithTax travels
 * alongside the total, and the percentage is computed only over the purchases that contributed.
 */
export function summarizeSpending(entries: SpendingEntry[]): SpendingSummary {
  // Cada mês carrega o gasto das notas que declararam tributo, que é o denominador do peso do
  // imposto dele — não dá pra derivar isso de fora depois, e é justamente o que permite a tela
  // trocar de mês sem uma segunda consulta.
  const months = new Map<string, MonthlySpending & { spentWithTax: number }>();
  let totalSpent = 0;
  let totalTax = 0;
  let spentWithTax = 0;
  let purchasesWithTax = 0;

  for (const entry of entries) {
    const key = entry.purchaseDate.slice(0, 7);
    const month =
      months.get(key) ?? { month: key, totalSpent: 0, totalTax: 0, purchaseCount: 0, purchasesWithTax: 0, taxSharePercent: null, spentWithTax: 0 };

    month.totalSpent += entry.totalAmount;
    month.purchaseCount += 1;
    totalSpent += entry.totalAmount;

    if (entry.taxAmount !== null) {
      month.totalTax += entry.taxAmount;
      month.purchasesWithTax += 1;
      month.spentWithTax += entry.totalAmount;
      totalTax += entry.taxAmount;
      spentWithTax += entry.totalAmount;
      purchasesWithTax += 1;
    }

    months.set(key, month);
  }

  return {
    totalSpent: round2(totalSpent),
    totalTax: round2(totalTax),
    taxSharePercent: spentWithTax > 0 ? round2((totalTax / spentWithTax) * 100) : null,
    purchaseCount: entries.length,
    purchasesWithTax,
    byMonth: Array.from(months.values())
      .map(({ spentWithTax, ...month }) => ({
        ...month,
        totalSpent: round2(month.totalSpent),
        totalTax: round2(month.totalTax),
        taxSharePercent: spentWithTax > 0 ? round2((month.totalTax / spentWithTax) * 100) : null,
      }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}
