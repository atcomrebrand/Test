const DEFAULT_WINDOW = 3;

export interface TrailingForecastInput {
  /** Totais de períodos já fechados, em ordem cronológica (mais antigo primeiro). O período
   *  corrente (ainda em andamento) não deve entrar aqui — só meses/competências já encerrados. */
  history: number[];
  windowSize?: number;
}

export interface TrailingForecastResult {
  /** Média dos últimos `windowSize` períodos — a previsão simples pro próximo. Null sem dados. */
  forecast: number | null;
  /** Variação % entre a média da janela atual e a da janela imediatamente anterior. Null quando
   *  não há histórico suficiente pra comparar (menos de duas janelas completas). */
  trendPct: number | null;
}

/**
 * Previsão por média móvel: sem tentar detectar sazonalidade ou ajustar curva, só a média dos
 * últimos meses fechados — transparente e fácil de explicar ("baseado nos últimos 3 meses"),
 * seguindo o mesmo espírito de generateInsights (regras simples e auditáveis, não caixa-preta).
 */
export function computeTrailingForecast({ history, windowSize = DEFAULT_WINDOW }: TrailingForecastInput): TrailingForecastResult {
  if (history.length === 0) return { forecast: null, trendPct: null };

  const window = history.slice(-windowSize);
  const forecast = round2(average(window));

  const previousWindow = history.slice(-windowSize * 2, -windowSize);
  const previousAverage = average(previousWindow);
  const trendPct = previousWindow.length > 0 && previousAverage > 0 ? round2(((average(window) - previousAverage) / previousAverage) * 100) : null;

  return { forecast, trendPct };
}

export interface ForecastInsightInput {
  /** Rótulo em português já flexionado pro contexto, ex: "seus gastos com cartão". */
  label: string;
  forecast: number | null;
  trendPct: number | null;
}

export function generateForecastInsight({ label, forecast, trendPct }: ForecastInsightInput): string | null {
  if (forecast === null) return null;
  if (trendPct === null || Math.abs(trendPct) < 1) {
    return `Previsão pro próximo mês em ${label}: ${formatCurrency(forecast)}, estável em relação aos últimos meses.`;
  }
  const direction = trendPct > 0 ? "alta" : "queda";
  return `Previsão pro próximo mês em ${label}: ${formatCurrency(forecast)}, tendência de ${direction} de ${Math.abs(Math.round(trendPct))}%.`;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
