/** Clamps `dueDay` to the last day of `referenceYear`/`referenceMonth` when the month is shorter
 *  (e.g. dueDay=31 in February) — same clamping approach used by the financing installment
 *  generator. Noon avoids any timezone rollover shifting the calendar day. */
export function resolveDueDate(referenceYear: number, referenceMonth: number, dueDay: number): Date {
  const daysInMonth = new Date(referenceYear, referenceMonth, 0).getDate();
  const clampedDay = Math.min(dueDay, daysInMonth);
  return new Date(referenceYear, referenceMonth - 1, clampedDay, 12, 0, 0);
}
