/**
 * O extrato de um trabalho num período.
 *
 * Ele existe pra ser **impresso e entregue**, e é isso que dita a regra mais importante daqui: há
 * dois públicos, e o da empresa não pode ver dinheiro. Esse corte é feito no domain e repetido no
 * service antes de a resposta sair — não na tela. Esconder um número no frontend é conforto, não
 * tranca: a resposta continua alcançável por curl, e um extrato que a pessoa acredita ser seguro
 * mas carrega o valor-hora no JSON é pior do que não ter o modo empresa.
 */
export type StatementAudience = "PERSONAL" | "COMPANY";
export type StatementLang = "PT" | "EN";

export interface StatementSessionInput {
  /** ISO yyyy-mm-dd do dia do check-in, já no fuso do Brasil. */
  date: string;
  checkIn: string;
  checkOut: string | null;
  netSeconds: number;
  /** Valor equivalente às horas dessa sessão. Nunca sai na versão da empresa. */
  value: number;
  notes: string | null;
  placement: number | null;
  satisfactionPercent: number | null;
  responseMinutes: number | null;
}

export interface StatementSession extends StatementSessionInput {
  /** As observações traduzidas, quando o extrato é em inglês. Null = nada a traduzir. */
  notesTranslated?: string | null;
}

export interface StatementDay {
  date: string;
  hours: number;
  sessions: number;
}

export interface MetricSummary {
  best: number;
  average: number;
  days: number;
}

export interface StatementTotals {
  /** Segundos líquidos, somados. A tela formata; o domain não decide formato. */
  netSeconds: number;
  hours: number;
  /** Dias distintos com ao menos uma sessão — não é o mesmo que número de sessões. */
  daysWorked: number;
  sessions: number;
  /** Média por dia TRABALHADO, não por dia do período: dividir por 30 num mês em que se
   *  trabalhou 12 dias mede o calendário, não a jornada. */
  averageHoursPerWorkedDay: number;
  /** Só na versão pessoal. `null` na da empresa, e é assim que a tela sabe que não deve mostrar. */
  totalValue: number | null;
  averageHourlyRate: number | null;
}

export interface StatementPlacement {
  /** Menor é melhor. */
  placement: MetricSummary | null;
  /** Maior é melhor. */
  satisfaction: MetricSummary | null;
  /** Menor é melhor. */
  responseMinutes: MetricSummary | null;
  points: { date: string; placement: number | null; satisfactionPercent: number | null; responseMinutes: number | null }[];
}

export interface StatementSummary {
  totals: StatementTotals;
  byDay: StatementDay[];
  placement: StatementPlacement | null;
  sessions: StatementSession[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function summarize(values: number[], lowerIsBetter: boolean): MetricSummary | null {
  if (values.length === 0) return null;
  return {
    best: lowerIsBetter ? Math.min(...values) : Math.max(...values),
    average: round2(values.reduce((a, b) => a + b, 0) / values.length),
    days: values.length,
  };
}

/**
 * Monta o extrato a partir das sessões do período.
 *
 * `audience` decide o que sequer é calculado: na versão da empresa, valor e valor-hora saem como
 * `null` e o `value` de cada sessão é zerado, então não existe caminho pelo qual o número chegue
 * ao PDF. `tracksPlacement` vem do trabalho: sem o sistema de colocação, o bloco inteiro é `null`
 * em vez de vir zerado — zero sugere "foi medido e deu zero", que é outra coisa.
 */
export function buildStatement(
  sessions: StatementSessionInput[],
  options: { audience: StatementAudience; tracksPlacement: boolean },
): StatementSummary {
  const pessoal = options.audience === "PERSONAL";
  const ordenadas = [...sessions].sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  const netSeconds = ordenadas.reduce((acc, s) => acc + s.netSeconds, 0);
  const totalValue = ordenadas.reduce((acc, s) => acc + s.value, 0);

  const porDia = new Map<string, StatementDay>();
  for (const s of ordenadas) {
    const atual = porDia.get(s.date) ?? { date: s.date, hours: 0, sessions: 0 };
    atual.hours = round2(atual.hours + s.netSeconds / 3600);
    atual.sessions += 1;
    porDia.set(s.date, atual);
  }
  const byDay = [...porDia.values()].sort((a, b) => a.date.localeCompare(b.date));

  const horas = netSeconds / 3600;

  return {
    totals: {
      netSeconds,
      hours: round2(horas),
      daysWorked: byDay.length,
      sessions: ordenadas.length,
      averageHoursPerWorkedDay: byDay.length > 0 ? round2(horas / byDay.length) : 0,
      totalValue: pessoal ? round2(totalValue) : null,
      // Valor-hora médio do período, e não o do trabalho: num freelance ele muda conforme as horas
      // acumulam, e o número que interessa no extrato é o que aquelas horas de fato renderam.
      averageHourlyRate: pessoal && horas > 0 ? round2(totalValue / horas) : null,
    },
    byDay,
    placement: options.tracksPlacement
      ? {
          placement: summarize(
            ordenadas.map((s) => s.placement).filter((v): v is number => v !== null),
            true,
          ),
          satisfaction: summarize(
            ordenadas.map((s) => s.satisfactionPercent).filter((v): v is number => v !== null),
            false,
          ),
          responseMinutes: summarize(
            ordenadas.map((s) => s.responseMinutes).filter((v): v is number => v !== null),
            true,
          ),
          points: ordenadas.map((s) => ({
            date: s.date,
            placement: s.placement,
            satisfactionPercent: s.satisfactionPercent,
            responseMinutes: s.responseMinutes,
          })),
        }
      : null,
    // O valor de cada linha some junto: a tabela do extrato da empresa lista as horas, nunca o
    // quanto elas valeram.
    sessions: ordenadas.map((s) => ({ ...s, value: pessoal ? round2(s.value) : 0 })),
  };
}
