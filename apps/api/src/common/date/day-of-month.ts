/**
 * Cards can close/due on any day 1-31, but not every month has 31 days.
 * These helpers consistently clamp to the last real day of the target month
 * (e.g. due day 31 becomes Feb 28/29) instead of letting `Date` silently
 * overflow into the next month, which is what `new Date(y, m, 31)` does for
 * a 28/29/30-day month.
 */
export function clampDayToMonth(year: number, month0to11: number, day: number): number {
  const daysInMonth = new Date(year, month0to11 + 1, 0).getDate();
  return Math.min(day, daysInMonth);
}

/** A Date for `day` within the given month (1-based), clamped to that month's real length. */
export function dateForDayInMonth(year: number, month1to12: number, day: number): Date {
  const clamped = clampDayToMonth(year, month1to12 - 1, day);
  return new Date(year, month1to12 - 1, clamped, 12, 0, 0);
}

/** Next occurrence of `day` strictly after `from`, clamped per month. */
export function nextOccurrenceOfDay(from: Date, day: number): Date {
  const candidate = dateForDayInMonth(from.getFullYear(), from.getMonth() + 1, day);
  if (candidate > from) return candidate;

  const nextMonth = new Date(from.getFullYear(), from.getMonth() + 1, 1);
  return dateForDayInMonth(nextMonth.getFullYear(), nextMonth.getMonth() + 1, day);
}
