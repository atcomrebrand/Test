import { summarizeAssetValueHistory } from "./asset-value-history";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("summarizeAssetValueHistory", () => {
  it("resume a trajetória do valor do bem entre a primeira e a última avaliação", () => {
    const trend = summarizeAssetValueHistory([
      { amount: 62000, valuedAt: d("2026-02-10") },
      { amount: 60000, valuedAt: d("2026-05-10") },
      { amount: 58500, valuedAt: d("2026-08-10") },
    ])!;

    expect(trend.first.amount).toBe(62000);
    expect(trend.latest.amount).toBe(58500);
    expect(trend.previous?.amount).toBe(60000);
    expect(trend.changeFromPrevious).toBe(-1500);
    expect(trend.changePercentFromPrevious).toBe(-2.5);
    expect(trend.changeSinceFirst).toBe(-3500);
    expect(trend.changePercentSinceFirst).toBe(-5.6);
    expect(trend.daysTracked).toBe(181);
  });

  /** O repositório ordena, mas o resumo não pode depender disso — fora de ordem, "a última
   *  avaliação" viraria a que por acaso estava no fim do array. */
  it("ordena por data antes de resumir, mesmo recebendo fora de ordem", () => {
    const trend = summarizeAssetValueHistory([
      { amount: 58500, valuedAt: d("2026-08-10") },
      { amount: 62000, valuedAt: d("2026-02-10") },
    ])!;

    expect(trend.first.amount).toBe(62000);
    expect(trend.latest.amount).toBe(58500);
  });

  it("com uma única avaliação não há variação anterior, e a variação desde a primeira é zero", () => {
    const trend = summarizeAssetValueHistory([{ amount: 60000, valuedAt: d("2026-08-10") }])!;

    expect(trend.previous).toBeNull();
    expect(trend.changeFromPrevious).toBeNull();
    expect(trend.changePercentFromPrevious).toBeNull();
    expect(trend.changeSinceFirst).toBe(0);
    expect(trend.changePercentSinceFirst).toBe(0);
    expect(trend.daysTracked).toBe(0);
  });

  it("bem que valorizou aparece com variação positiva", () => {
    const trend = summarizeAssetValueHistory([
      { amount: 250000, valuedAt: d("2025-08-10") },
      { amount: 275000, valuedAt: d("2026-08-10") },
    ])!;

    expect(trend.changeSinceFirst).toBe(25000);
    expect(trend.changePercentSinceFirst).toBe(10);
  });

  /** Sem avaliação nenhuma não existe tendência. Zerar tudo faria a tela exibir "0%" como se
   *  fosse medição, quando na verdade é ausência de dado. */
  it("devolve null quando não há nenhuma avaliação", () => {
    expect(summarizeAssetValueHistory([])).toBeNull();
  });

  it("não inventa percentual quando a base é zero", () => {
    const trend = summarizeAssetValueHistory([
      { amount: 0, valuedAt: d("2026-01-10") },
      { amount: 5000, valuedAt: d("2026-08-10") },
    ])!;

    expect(trend.changeSinceFirst).toBe(5000);
    expect(trend.changePercentSinceFirst).toBeNull();
  });
});
