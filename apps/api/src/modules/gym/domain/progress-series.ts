/**
 * As séries temporais do Progresso (§26) e o progresso das metas (§31).
 *
 * Tudo aqui recebe o que já foi lido do banco e devolve o que a tela desenha — nenhuma consulta,
 * nenhuma data "de hoje" por dentro: quem chama passa a referência. É o que torna testável um
 * módulo cheio de "esta semana".
 */

export type Bucket = "WEEK" | "MONTH";

export interface SessionPoint {
  startedAt: Date;
  totalVolume: number;
  durationSeconds: number | null;
}

export interface BucketPoint {
  /** Início do período, ISO yyyy-mm-dd. */
  key: string;
  sessions: number;
  volume: number;
  /** Minutos treinados no período. */
  minutes: number;
}

/** Segunda-feira como início da semana — é a convenção de "semana de treino" no Brasil. */
export function startOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

function bucketKey(date: Date, bucket: Bucket): string {
  if (bucket === "MONTH") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
  }
  return startOfWeek(date).toISOString().slice(0, 10);
}

/**
 * Agrupa as sessões por semana ou mês.
 *
 * Períodos sem treino aparecem zerados quando `from`/`to` são informados — no gráfico de frequência,
 * a semana em que não se treinou é justamente a informação: pular a barra faria parecer que houve
 * treino contínuo.
 */
export function bucketSessions(sessions: SessionPoint[], bucket: Bucket, from?: Date, to?: Date): BucketPoint[] {
  const mapa = new Map<string, BucketPoint>();

  if (from && to) {
    const cursor = bucket === "MONTH"
      ? new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1))
      : startOfWeek(from);
    while (cursor <= to) {
      mapa.set(bucketKey(cursor, bucket), { key: bucketKey(cursor, bucket), sessions: 0, volume: 0, minutes: 0 });
      if (bucket === "MONTH") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      else cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
  }

  for (const s of sessions) {
    const key = bucketKey(s.startedAt, bucket);
    const atual = mapa.get(key) ?? { key, sessions: 0, volume: 0, minutes: 0 };
    atual.sessions += 1;
    atual.volume = round2(atual.volume + s.totalVolume);
    atual.minutes += Math.round((s.durationSeconds ?? 0) / 60);
    mapa.set(key, atual);
  }

  return [...mapa.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export interface WeekSummary {
  done: number;
  target: number;
  minutes: number;
  volume: number;
}

/** O "4 / 5 treinos" da Home. */
export function summarizeWeek(sessions: SessionPoint[], reference: Date, weeklyTarget: number): WeekSummary {
  const inicio = startOfWeek(reference);
  const fim = new Date(inicio);
  fim.setUTCDate(fim.getUTCDate() + 7);

  const daSemana = sessions.filter((s) => s.startedAt >= inicio && s.startedAt < fim);
  return {
    done: daSemana.length,
    target: weeklyTarget,
    minutes: daSemana.reduce((acc, s) => acc + Math.round((s.durationSeconds ?? 0) / 60), 0),
    volume: round2(daSemana.reduce((acc, s) => acc + s.totalVolume, 0)),
  };
}

/**
 * Consistência: das semanas COMPLETAS do período, quantas bateram a meta.
 *
 * A semana corrente fica de fora — na segunda-feira ela sempre estaria em 0/5, e a consistência
 * despencaria toda semana por um motivo que não é o desempenho de ninguém.
 */
export function consistencyPercent(weeks: BucketPoint[], weeklyTarget: number, currentWeekKey: string): number | null {
  const completas = weeks.filter((w) => w.key !== currentWeekKey);
  if (completas.length === 0 || weeklyTarget <= 0) return null;
  const bateram = completas.filter((w) => w.sessions >= weeklyTarget).length;
  return Math.round((bateram / completas.length) * 1000) / 10;
}

/**
 * Progresso de uma meta, de 0 a 100.
 *
 * Medido a partir do PONTO DE PARTIDA e não do zero absoluto: quem sai de 80 kg mirando 100 kg e
 * está em 82,5 não fez 82,5% do caminho — fez 12,5%. Contar do zero mostraria uma barra quase cheia
 * no primeiro dia e quase parada por meses.
 */
export function targetProgress(current: number, target: number, start: number | null): number {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return 0;
  const base = start ?? 0;
  const caminho = target - base;
  if (caminho === 0) return current >= target ? 100 : 0;
  const feito = (current - base) / caminho;
  return Math.max(0, Math.min(100, Math.round(feito * 1000) / 10));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
