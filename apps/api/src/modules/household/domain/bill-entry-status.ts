export type HouseholdBillStatus = "PENDING" | "PARTIALLY_RESERVED" | "RESERVED" | "PAID" | "LATE";

export interface BillEntryStatusInput {
  amount: number;
  reservedAmount: number;
  paidAmount: number;
  dueDate: Date;
  /** Defaults to `new Date()` — pass a fixed value in tests for determinism. */
  asOf?: Date;
}

/**
 * Never chosen by the user — always derived from the entry's own numbers, recomputed on every
 * write so the stored `status` column never drifts from reality. Paid always wins (once the money
 * left, it left, regardless of the due date); late only matters for what's still unpaid.
 */
export function computeBillEntryStatus(input: BillEntryStatusInput): HouseholdBillStatus {
  const { amount, reservedAmount, paidAmount, dueDate, asOf = new Date() } = input;

  if (paidAmount >= amount) return "PAID";
  if (asOf > dueDate) return "LATE";
  if (reservedAmount >= amount) return "RESERVED";
  if (reservedAmount > 0) return "PARTIALLY_RESERVED";
  return "PENDING";
}
