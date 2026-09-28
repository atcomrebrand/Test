export type HouseholdBillStatus = "PENDING" | "PARTIALLY_RESERVED" | "RESERVED" | "PAID" | "LATE" | "SKIPPED";

export interface BillEntryStatusInput {
  amount: number;
  reservedAmount: number;
  paidAmount: number;
  dueDate: Date;
  /** "Não precisou pagar esse mês" — a manual override, set by the user, not derived from the
   *  amounts below. Takes priority over everything else. */
  skipped?: boolean;
  /** Defaults to `new Date()` — pass a fixed value in tests for determinism. */
  asOf?: Date;
}

/**
 * Mostly derived from the entry's own numbers, recomputed on every write so the stored `status`
 * column never drifts from reality — except `skipped`, the one status the user chooses directly.
 * Paid always wins over late (once the money left, it left, regardless of the due date); late
 * only matters for what's still unpaid; skipped wins over everything, since "didn't need to be
 * paid this month" isn't something reserved/paid amounts can express on their own.
 */
export function computeBillEntryStatus(input: BillEntryStatusInput): HouseholdBillStatus {
  const { amount, reservedAmount, paidAmount, dueDate, skipped = false, asOf = new Date() } = input;

  if (skipped) return "SKIPPED";
  if (paidAmount >= amount) return "PAID";
  if (asOf > dueDate) return "LATE";
  if (reservedAmount >= amount) return "RESERVED";
  if (reservedAmount > 0) return "PARTIALLY_RESERVED";
  return "PENDING";
}
