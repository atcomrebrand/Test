/**
 * Estimativa de repetição máxima.
 *
 * Nenhuma das fórmulas é "a certa": elas divergem entre si conforme a faixa de repetições — Brzycki
 * costuma ser mais conservadora em série curta e desanda perto de 37 reps (o denominador vai a
 * zero), Epley é mais generosa em série longa. Por isso a fórmula é escolha do usuário, e por isso
 * o 1RM calculado é **congelado** no recorde: trocar a preferência depois não pode reescrever um
 * recorde que já foi comemorado.
 */
export type OneRmFormula = "EPLEY" | "BRZYCKI" | "LOMBARDI";

/** Acima disso a extrapolação deixa de significar coisa alguma — e Brzycki explode em 37. */
const MAX_REPS = 30;

export function estimateOneRm(weight: number, reps: number, formula: OneRmFormula = "EPLEY"): number | null {
  if (!Number.isFinite(weight) || weight <= 0) return null;
  if (!Number.isFinite(reps) || reps < 1) return null;
  // Uma repetição JÁ é a máxima medida: extrapolar aqui inventaria 3% de carga que ninguém levantou.
  if (reps === 1) return round2(weight);
  if (reps > MAX_REPS) return null;

  switch (formula) {
    case "BRZYCKI":
      return round2(weight * (36 / (37 - reps)));
    case "LOMBARDI":
      return round2(weight * Math.pow(reps, 0.1));
    case "EPLEY":
    default:
      return round2(weight * (1 + reps / 30));
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
