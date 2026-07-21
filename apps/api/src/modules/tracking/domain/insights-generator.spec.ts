import { generateInsights, InsightsInput } from "./insights-generator";

function baseInput(overrides: Partial<InsightsInput> = {}): InsightsInput {
  return {
    currentPeriodHours: 0,
    previousPeriodHours: 0,
    currentPeriodHourlyRate: null,
    previousPeriodHourlyRate: null,
    topClient: null,
    freelanceRevenueThisMonth: 0,
    averageDailyHours: null,
    forgottenCheckoutsCount: 0,
    daysSinceLastSession: null,
    isBestMonthEver: false,
    bestProductivityWindow: null,
    ...overrides,
  };
}

describe("generateInsights", () => {
  it("reports a percentage increase in hours vs the previous period", () => {
    const insights = generateInsights(baseInput({ currentPeriodHours: 118, previousPeriodHours: 100 }));
    expect(insights).toContain("Você trabalhou 18% mais que no mês anterior.");
  });

  it("reports a percentage decrease in hours vs the previous period", () => {
    const insights = generateInsights(baseInput({ currentPeriodHours: 80, previousPeriodHours: 100 }));
    expect(insights).toContain("Você trabalhou 20% menos que no mês anterior.");
  });

  it("skips the hours-comparison insight when there's no previous period", () => {
    const insights = generateInsights(baseInput({ currentPeriodHours: 100, previousPeriodHours: 0 }));
    expect(insights.some((i) => i.includes("mês anterior"))).toBe(false);
  });

  it("reports hourly-rate increase", () => {
    const insights = generateInsights(baseInput({ currentPeriodHourlyRate: 56, previousPeriodHourlyRate: 50 }));
    expect(insights).toContain("Seu valor por hora aumentou 12%.");
  });

  it("names the top client", () => {
    const insights = generateInsights(baseInput({ topClient: { name: "Acme Corp", revenue: 5000 } }));
    expect(insights).toContain("Seu cliente mais lucrativo foi Acme Corp.");
  });

  it("reports freelance revenue formatted as BRL currency", () => {
    const insights = generateInsights(baseInput({ freelanceRevenueThisMonth: 3500 }));
    expect(insights.some((i) => i.includes("R$") && i.includes("projetos extras"))).toBe(true);
  });

  it("formats average daily hours with minutes (6.8h -> 6h48)", () => {
    const insights = generateInsights(baseInput({ averageDailyHours: 6.8 }));
    expect(insights).toContain("Você trabalhou em média 6h48 por dia.");
  });

  it("pluralizes forgotten checkouts correctly", () => {
    const singular = generateInsights(baseInput({ forgottenCheckoutsCount: 1 }));
    const plural = generateInsights(baseInput({ forgottenCheckoutsCount: 2 }));
    expect(singular).toContain("Você esqueceu de finalizar 1 sessão.");
    expect(plural).toContain("Você esqueceu de finalizar 2 sessões.");
  });

  it("flags the best month ever", () => {
    const insights = generateInsights(baseInput({ isBestMonthEver: true }));
    expect(insights).toContain("Esse foi seu melhor mês desde que começou a utilizar o sistema.");
  });

  it("reports days without registering hours only when 2 or more", () => {
    const oneDaySkipped = generateInsights(baseInput({ daysSinceLastSession: 1 }));
    const fourDaysSkipped = generateInsights(baseInput({ daysSinceLastSession: 4 }));
    expect(oneDaySkipped.some((i) => i.includes("dias sem registrar"))).toBe(false);
    expect(fourDaysSkipped).toContain("Você ficou 4 dias sem registrar horas.");
  });

  it("reports the best productivity window", () => {
    const insights = generateInsights(baseInput({ bestProductivityWindow: { startHour: 9, endHour: 12 } }));
    expect(insights).toContain("O melhor horário para sua produtividade é entre 09:00 e 12:00.");
  });

  it("returns an empty array when nothing is noteworthy", () => {
    expect(generateInsights(baseInput())).toEqual([]);
  });
});
