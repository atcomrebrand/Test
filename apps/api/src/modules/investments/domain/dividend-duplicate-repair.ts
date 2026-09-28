import { DATE_TOLERANCE_DAYS, isWithinTolerance } from "./dividend-matching";

/** Notes prefix that marks an income as created by the automatic dividend sync — the only rows
 *  this repair is ever allowed to delete, since they're recomputable from the event history by
 *  definition. Manual entries and B3-imported incomes carry different notes and are untouchable. */
export const AUTO_SYNC_NOTES_MARKER = "Calculado automaticamente";

export interface RepairableIncome {
  id: string;
  amount: number;
  /** ISO yyyy-mm-dd. */
  paymentDate: string;
  notes: string | null;
}

export interface RepairableEvent {
  /** rate × position held on the event's ex-date, rounded like the sync records it. */
  estimatedAmount: number;
  exDate: string | null;
  paymentDate: string | null;
}

function daysBetween(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

/** Smallest distance from an income's date to either of the event's dates — an income recorded
 *  under the ex-date (all Yahoo-sourced syncs did this) and one recorded under the real payment
 *  date are BOTH close to the same event, just via different anchors. */
function distanceToEvent(income: RepairableIncome, event: RepairableEvent): number {
  const distances = [event.paymentDate, event.exDate]
    .filter((d): d is string => d !== null)
    .map((d) => daysBetween(income.paymentDate, d));
  return distances.length > 0 ? Math.min(...distances) : Infinity;
}

/**
 * Finds auto-created incomes that are redundant recordings of the same dividend event, returning
 * the ids to delete. This is the data repair for the duplication the 2026-08-04 source switch
 * caused (see DividendAutoSyncService): each auto-created income is attributed to its single
 * closest matching event (amount within tolerance, date within tolerance of either event date);
 * when two or more incomes land on the same event, the one nearest the event's real payment date
 * is kept — so the survivor is the correctly-dated row — and the rest are flagged.
 *
 * Deliberately conservative: incomes without the auto-sync marker are never flagged, and neither
 * are incomes that don't confidently match any event (no event evidence → no deletion), so a
 * failure to fetch events can never trigger a wipe.
 */
export function findDuplicateAutoIncomes(incomes: RepairableIncome[], events: RepairableEvent[]): string[] {
  const autoIncomes = incomes.filter((i) => i.notes?.startsWith(AUTO_SYNC_NOTES_MARKER));
  if (autoIncomes.length < 2 || events.length === 0) return [];

  const byEvent = new Map<number, { income: RepairableIncome; distance: number }[]>();
  for (const income of autoIncomes) {
    let bestEvent = -1;
    let bestDistance = Infinity;
    for (let e = 0; e < events.length; e++) {
      if (!isWithinTolerance(income.amount, events[e].estimatedAmount)) continue;
      const distance = distanceToEvent(income, events[e]);
      if (distance <= DATE_TOLERANCE_DAYS && distance < bestDistance) {
        bestDistance = distance;
        bestEvent = e;
      }
    }
    if (bestEvent < 0) continue;
    const group = byEvent.get(bestEvent) ?? [];
    group.push({ income, distance: bestDistance });
    byEvent.set(bestEvent, group);
  }

  const toDelete: string[] = [];
  for (const [eventIndex, group] of byEvent) {
    if (group.length < 2) continue;
    const event = events[eventIndex];
    const anchor = event.paymentDate ?? event.exDate;
    const sorted = [...group].sort((a, b) => {
      const distA = anchor ? daysBetween(a.income.paymentDate, anchor) : a.distance;
      const distB = anchor ? daysBetween(b.income.paymentDate, anchor) : b.distance;
      return distA - distB;
    });
    for (const { income } of sorted.slice(1)) toDelete.push(income.id);
  }
  return toDelete;
}
