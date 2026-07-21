export interface InsightsInput {
  currentPeriodHours: number;
  previousPeriodHours: number;
  currentPeriodHourlyRate: number | null;
  previousPeriodHourlyRate: number | null;
  topClient: { name: string; revenue: number } | null;
  freelanceRevenueThisMonth: number;
  averageDailyHours: number | null;
  forgottenCheckoutsCount: number;
  daysSinceLastSession: number | null;
  isBestMonthEver: boolean;
  bestProductivityWindow: { startHour: number; endHour: number } | null;
}

/**
 * Pure text-generation over already-computed stats — no I/O, so it's trivially testable with fixed
 * fixtures. Each insight is independently gated (missing/zero input just skips that line) so the
 * caller can pass partial data without special-casing anything.
 */
export function generateInsights(input: InsightsInput): string[] {
  const insights: string[] = [];

  if (input.previousPeriodHours > 0) {
    const pctChange = ((input.currentPeriodHours - input.previousPeriodHours) / input.previousPeriodHours) * 100;
    if (Math.abs(pctChange) >= 1) {
      const direction = pctChange > 0 ? "mais" : "menos";
      insights.push(`Você trabalhou ${Math.abs(Math.round(pctChange))}% ${direction} que no mês anterior.`);
    }
  }

  if (input.previousPeriodHourlyRate && input.currentPeriodHourlyRate) {
    const pctChange = ((input.currentPeriodHourlyRate - input.previousPeriodHourlyRate) / input.previousPeriodHourlyRate) * 100;
    if (Math.abs(pctChange) >= 1) {
      const direction = pctChange > 0 ? "aumentou" : "diminuiu";
      insights.push(`Seu valor por hora ${direction} ${Math.abs(Math.round(pctChange))}%.`);
    }
  }

  if (input.topClient) {
    insights.push(`Seu cliente mais lucrativo foi ${input.topClient.name}.`);
  }

  if (input.freelanceRevenueThisMonth > 0) {
    insights.push(`Você faturou ${formatCurrency(input.freelanceRevenueThisMonth)} em projetos extras.`);
  }

  if (input.averageDailyHours !== null && input.averageDailyHours > 0) {
    insights.push(`Você trabalhou em média ${formatHours(input.averageDailyHours)} por dia.`);
  }

  if (input.forgottenCheckoutsCount > 0) {
    const noun = input.forgottenCheckoutsCount === 1 ? "sessão" : "sessões";
    insights.push(`Você esqueceu de finalizar ${input.forgottenCheckoutsCount} ${noun}.`);
  }

  if (input.isBestMonthEver) {
    insights.push("Esse foi seu melhor mês desde que começou a utilizar o sistema.");
  }

  if (input.daysSinceLastSession !== null && input.daysSinceLastSession >= 2) {
    insights.push(`Você ficou ${input.daysSinceLastSession} dias sem registrar horas.`);
  }

  if (input.bestProductivityWindow) {
    insights.push(
      `O melhor horário para sua produtividade é entre ${formatHour(input.bestProductivityWindow.startHour)} e ${formatHour(input.bestProductivityWindow.endHour)}.`,
    );
  }

  return insights;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}
