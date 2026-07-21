export interface JobHourlyEstimateInput {
  monthlyValue: number;
  expectedHoursPerDay: number;
  /** 0=domingo..6=sábado */
  weekdays: number[];
}

/** Average weeks in a month (365.25 / 12 / 7) — a fixed constant, not derived per-month, so the
 *  estimate stays stable across the year instead of jittering with each month's exact day count. */
const WEEKS_PER_MONTH = 4.345;

/**
 * Before enough session history exists for a trabalho fixo, this is the only way to answer "quanto
 * vale minha hora": monthly value ÷ the expected worked hours in a month, derived from which
 * weekdays the job runs and how many hours a day. Once real sessions accumulate, callers should
 * prefer the actual historical average from `computeHourlyRateBreakdown` instead of this estimate.
 */
export function estimateJobHourlyRate(input: JobHourlyEstimateInput): number {
  const { monthlyValue, expectedHoursPerDay, weekdays } = input;

  if (monthlyValue <= 0) throw new Error("Valor mensal deve ser maior que zero.");
  if (expectedHoursPerDay <= 0) throw new Error("Horas esperadas por dia deve ser maior que zero.");
  if (weekdays.length === 0) throw new Error("Informe ao menos um dia da semana trabalhado.");

  const expectedMonthlyHours = weekdays.length * expectedHoursPerDay * WEEKS_PER_MONTH;
  return Math.round((monthlyValue / expectedMonthlyHours) * 100) / 100;
}
