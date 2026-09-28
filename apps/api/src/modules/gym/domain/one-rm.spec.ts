import { estimateOneRm } from "./one-rm";

describe("estimateOneRm", () => {
  it("Epley: 80 kg × 8 dá ≈101 kg, o número que a tela mostra", () => {
    expect(estimateOneRm(80, 8, "EPLEY")).toBe(101.33);
  });

  it("uma repetição é a própria carga, em qualquer fórmula", () => {
    // Epley aplicada cegamente daria 82,67 kg — 1RM estimado maior que o 1RM realizado.
    for (const f of ["EPLEY", "BRZYCKI", "LOMBARDI"] as const) {
      expect(estimateOneRm(80, 1, f)).toBe(80);
    }
  });

  it("as fórmulas divergem, e é por isso que a escolha existe", () => {
    const epley = estimateOneRm(100, 10, "EPLEY")!;
    const brzycki = estimateOneRm(100, 10, "BRZYCKI")!;
    const lombardi = estimateOneRm(100, 10, "LOMBARDI")!;
    expect(epley).toBe(133.33);
    expect(brzycki).toBe(133.33);
    expect(lombardi).toBe(125.89);
    // Em série curta elas se separam pro outro lado.
    expect(estimateOneRm(100, 3, "BRZYCKI")).toBeLessThan(estimateOneRm(100, 3, "EPLEY")!);
  });

  it("recusa faixa em que a extrapolação não significa nada", () => {
    expect(estimateOneRm(100, 45)).toBeNull();
    // 37 zeraria o denominador de Brzycki; o corte em 30 acontece antes disso.
    expect(estimateOneRm(100, 37, "BRZYCKI")).toBeNull();
  });

  it("recusa entrada inválida em vez de devolver zero", () => {
    expect(estimateOneRm(0, 8)).toBeNull();
    expect(estimateOneRm(-10, 8)).toBeNull();
    expect(estimateOneRm(80, 0)).toBeNull();
    expect(estimateOneRm(NaN, 8)).toBeNull();
  });
});
