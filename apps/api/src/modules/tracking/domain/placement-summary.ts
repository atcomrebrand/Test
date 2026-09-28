/**
 * Colocação diária de um serviço com ranking.
 *
 * Três números independentes que o serviço divulga no fim do dia: a posição no ranking, a
 * satisfação dos clientes (que votam de 1 a 5 estrelas e o serviço consolida em porcentagem) e o
 * tempo médio de resposta em minutos.
 *
 * As três direções são diferentes, e isso é a regra que sustenta o módulo inteiro: em posição e
 * tempo de resposta **menor é melhor**; em satisfação, maior. Um resumo que tratasse os três como
 * "quanto maior melhor" diria que o dia em que você foi de 1º pra 12º foi o seu melhor dia.
 */
export interface PlacementEntry {
  date: string;
  placement: number | null;
  satisfactionPercent: number | null;
  responseMinutes: number | null;
}

export interface MetricSummary {
  /** O melhor valor do período, já respeitando a direção da métrica. */
  best: number;
  average: number;
  /** Quantos dias têm esse número — cada métrica é opcional por si, então elas divergem. */
  days: number;
  /** Do primeiro ao último dia COM dado. Positivo = melhorou, seguindo a direção da métrica. */
  trend: number | null;
}

export interface PlacementSummary {
  placement: MetricSummary | null;
  satisfaction: MetricSummary | null;
  responseMinutes: MetricSummary | null;
  /** Dias com pelo menos um dos três informados. */
  daysWithData: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Resumo de uma métrica.
 *
 * `lowerIsBetter` não é um detalhe de exibição: ele decide o que é "melhor" e qual sinal a
 * tendência tem. Sem ele, "de 12º pra 1º" apareceria como −11 (queda) quando é a maior subida
 * possível.
 */
function summarize(values: number[], lowerIsBetter: boolean): MetricSummary | null {
  if (values.length === 0) return null;

  const best = lowerIsBetter ? Math.min(...values) : Math.max(...values);
  const average = round2(values.reduce((a, b) => a + b, 0) / values.length);
  // Um dia só não tem tendência: comparar o valor com ele mesmo daria sempre zero, que se lê como
  // "estável" quando na verdade ainda não dá pra dizer nada.
  const trend =
    values.length < 2 ? null : round2(lowerIsBetter ? values[0] - values[values.length - 1] : values[values.length - 1] - values[0]);

  return { best, average, days: values.length, trend };
}

/**
 * Só entra no resumo o que foi informado.
 *
 * Tratar ausente como zero seria desastroso nas três métricas por motivos diferentes: viraria uma
 * "colocação 0" melhor que o primeiro lugar, uma satisfação de 0% que afunda a média, e um tempo de
 * resposta instantâneo que vira o recorde do período.
 */
export function summarizePlacements(entries: PlacementEntry[]): PlacementSummary {
  const ordenado = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  return {
    placement: summarize(
      ordenado.map((e) => e.placement).filter((v): v is number => v !== null),
      true,
    ),
    satisfaction: summarize(
      ordenado.map((e) => e.satisfactionPercent).filter((v): v is number => v !== null),
      false,
    ),
    responseMinutes: summarize(
      ordenado.map((e) => e.responseMinutes).filter((v): v is number => v !== null),
      true,
    ),
    daysWithData: ordenado.filter((e) => e.placement !== null || e.satisfactionPercent !== null || e.responseMinutes !== null)
      .length,
  };
}

export type PlacementValidation = { ok: true; value: PlacementInput } | { ok: false; reason: string };

/** Só carrega o que foi realmente mandado: campo ausente aqui é campo que a gravação não encosta. */
export interface PlacementInput {
  placement?: number | null;
  satisfactionPercent?: number | null;
  responseMinutes?: number | null;
}

/**
 * Valida o que veio da tela (ou de um curl direto na API).
 *
 * `undefined` é "não mexi nesse campo" e `null` é "apague o que estava lá" — os dois precisam
 * existir separados, senão não haveria como corrigir uma colocação lançada errada sem apagar as
 * outras duas junto.
 */
export function parsePlacementInput(raw: {
  placement?: number | null;
  satisfactionPercent?: number | null;
  responseMinutes?: number | null;
}): PlacementValidation {
  const { placement, satisfactionPercent: satisfaction, responseMinutes: response } = raw;

  // Posição começa no 1: não existe "zero-ésimo lugar", e um 0 aceito viraria o recorde do período.
  if (placement != null && (!Number.isInteger(placement) || placement < 1)) {
    return { ok: false, reason: "A colocação precisa ser um número inteiro a partir de 1." };
  }
  if (satisfaction != null && (!Number.isFinite(satisfaction) || satisfaction < 0 || satisfaction > 100)) {
    return { ok: false, reason: "A satisfação precisa estar entre 0% e 100%." };
  }
  // Zero minuto é resposta instantânea — valor legítimo, e por isso a ausência precisa ser null.
  if (response != null && (!Number.isInteger(response) || response < 0)) {
    return { ok: false, reason: "O tempo de resposta precisa ser um número inteiro de minutos, a partir de 0." };
  }

  // Cada campo entra no resultado SÓ se veio na requisição. `undefined` é "não mexi nesse campo" e
  // `null` é "apague o que estava lá": tratar os dois como null fazia corrigir a colocação apagar a
  // satisfação e o tempo de resposta junto, sem ninguém ter pedido.
  const value: PlacementInput = {};
  if (placement !== undefined) value.placement = placement;
  if (satisfaction !== undefined) value.satisfactionPercent = satisfaction === null ? null : round2(satisfaction);
  if (response !== undefined) value.responseMinutes = response;

  return { ok: true, value };
}
