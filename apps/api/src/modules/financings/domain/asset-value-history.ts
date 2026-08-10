/**
 * Série de avaliações de um bem financiado (FIPE do carro, avaliação do imóvel).
 *
 * O valor de hoje não substitui o de antes — a tabela muda todo mês e o que interessa é a
 * trajetória: um carro que desvalorizou R$ 3.000 em seis meses conta uma história diferente de um
 * imóvel que valorizou R$ 20.000, mesmo que os dois estejam no mesmo patamar de patrimônio agora.
 */

export interface AssetValuation {
  amount: number;
  valuedAt: Date;
}

export interface AssetValueTrend {
  first: AssetValuation;
  latest: AssetValuation;
  /** Avaliação imediatamente anterior à última. null quando só existe uma avaliação. */
  previous: AssetValuation | null;
  /** latest − previous. null sem avaliação anterior. */
  changeFromPrevious: number | null;
  changePercentFromPrevious: number | null;
  /** latest − first. Zero quando só há uma avaliação (a primeira é a última). */
  changeSinceFirst: number;
  changePercentSinceFirst: number | null;
  /** Dias corridos entre a primeira e a última avaliação — dá escala à variação acima. */
  daysTracked: number;
}

function percentChange(from: number, to: number): number | null {
  if (from <= 0) return null; // variação percentual sobre base zero é indefinida, não infinita
  return Math.round(((to - from) / from) * 1000) / 10;
}

/**
 * Resume a série. Recebe as avaliações em qualquer ordem e ordena por data — o repositório já
 * devolve ordenado, mas depender disso deixaria o resumo errado em silêncio se a ordem mudasse.
 * Devolve null pra série vazia: sem nenhuma avaliação não há tendência, e devolver zeros faria
 * a tela mostrar "0% de variação" como se fosse um fato medido.
 */
export function summarizeAssetValueHistory(valuations: AssetValuation[]): AssetValueTrend | null {
  if (valuations.length === 0) return null;

  const ordered = [...valuations].sort((a, b) => a.valuedAt.getTime() - b.valuedAt.getTime());
  const first = ordered[0];
  const latest = ordered[ordered.length - 1];
  const previous = ordered.length > 1 ? ordered[ordered.length - 2] : null;

  return {
    first,
    latest,
    previous,
    changeFromPrevious: previous ? latest.amount - previous.amount : null,
    changePercentFromPrevious: previous ? percentChange(previous.amount, latest.amount) : null,
    changeSinceFirst: latest.amount - first.amount,
    changePercentSinceFirst: percentChange(first.amount, latest.amount),
    daysTracked: Math.max(
      0,
      Math.round((Date.UTC(latest.valuedAt.getUTCFullYear(), latest.valuedAt.getUTCMonth(), latest.valuedAt.getUTCDate()) -
        Date.UTC(first.valuedAt.getUTCFullYear(), first.valuedAt.getUTCMonth(), first.valuedAt.getUTCDate())) / 86_400_000),
    ),
  };
}
