/** Shared "is this computed dividend already on file" matching rules — used both by the B3 import
 *  preview (surfacing unmatched historical events as suggestions) and by the automatic dividend
 *  sync (deciding whether a BRAPI-reported event still needs to be recorded). Amounts are compared
 *  with tolerance because a per-share rate times a reconstructed historical position is an
 *  estimate, not necessarily bit-for-bit identical to whatever exact figure a broker statement or
 *  manual entry recorded for the same payment. */
export const AMOUNT_TOLERANCE = 0.2; // 20% relative tolerance
export const DATE_TOLERANCE_DAYS = 5;

export function isCloseMatch(dateA: string, dateB: string): boolean {
  const daysDiff = Math.abs((new Date(dateA).getTime() - new Date(dateB).getTime()) / 86400000);
  return daysDiff <= DATE_TOLERANCE_DAYS;
}

export function isWithinTolerance(a: number, b: number): boolean {
  const rel = Math.abs(a - b) / Math.max(a, b, 0.01);
  return rel <= AMOUNT_TOLERANCE;
}
