import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { GymMuscleKey, MuscleLoad, MuscleSetInput, summarizeMuscleLoad } from "../domain/muscle-load";

/** Um ponto da progressão do músculo: uma semana, o volume dela e a maior carga. */
export interface MuscleWeekPoint {
  /** Segunda-feira da semana, "yyyy-mm-dd". */
  week: string;
  volume: number;
  sets: number;
  topWeight: number;
}

export interface MuscleMapResponse {
  days: number;
  /** O "hoje" usado no corte, pra tela não recalcular por conta própria e discordar. */
  today: string;
  muscles: MuscleLoad[];
  /** Progressão semanal por músculo, sempre nas últimas 12 semanas — independente da janela do
   *  mapa, porque a pergunta do detalhe ("estou evoluindo nisso?") não é a mesma do boneco
   *  ("treinei isso essa semana?") e um gráfico de 7 dias teria um ponto só. */
  evolution: Record<string, MuscleWeekPoint[]>;
}

const SEMANAS_DE_PROGRESSAO = 12;

/**
 * O mapa muscular: quanto cada grupo foi treinado, pra pintar o boneco.
 *
 * Uma consulta só, e ela já é a mais larga que o módulo faz — por isso pega apenas as colunas
 * necessárias e nunca a sessão inteira. Numa VPS de 1GB, uma tela que abre a cada visita não pode
 * carregar o histórico completo pra somar em JS.
 */
@Injectable()
export class GymMuscleMapService {
  constructor(private readonly prisma: PrismaService) {}

  async map(userId: string, days: number): Promise<MuscleMapResponse> {
    // Das 21h à meia-noite de Brasília o UTC já virou o dia seguinte; ler daí empurraria a janela
    // inteira um dia à frente.
    const today = diaNoBrasil(new Date());
    // Busca o bastante pras duas perguntas: a janela do boneco e as 12 semanas do gráfico. O
    // "último treino" precisaria do histórico inteiro, mas ele é resolvido por uma consulta própria
    // e barata (um max por músculo sairia caro aqui) — ver `ultimoTreino`.
    const desde = new Date(Date.now() - Math.max(days, SEMANAS_DE_PROGRESSAO * 7) * 86_400_000);

    const series = await this.prisma.gymSet.findMany({
      where: { session: { userId, finishedAt: { not: null }, startedAt: { gte: desde } }, completed: true },
      select: {
        weight: true,
        reps: true,
        sessionId: true,
        session: { select: { startedAt: true } },
        exercise: { select: { id: true, name: true, primaryMuscle: true, secondaryMuscles: true } },
      },
    });

    const entradas = series.map((s) => ({
      date: diaNoBrasil(s.session.startedAt),
      sessionId: s.sessionId,
      exerciseId: s.exercise.id,
      exerciseName: s.exercise.name,
      primaryMuscle: s.exercise.primaryMuscle as GymMuscleKey,
      secondaryMuscles: s.exercise.secondaryMuscles as GymMuscleKey[],
      weight: Number(s.weight),
      reps: s.reps,
    }));

    const muscles = summarizeMuscleLoad(entradas, days, today);

    // O último treino de um músculo pode ser mais antigo que a janela carregada — e é justamente o
    // caso que o modo Atenção existe pra mostrar. Quem ficou sem data aqui vai buscar mais fundo.
    const semData = muscles.filter((m) => m.lastTrainedAt === null).map((m) => m.muscle);
    if (semData.length > 0) await this.completarUltimoTreino(userId, muscles, semData, today);

    return { days, today, muscles, evolution: this.evolucao(entradas, today) };
  }

  /**
   * Busca o último treino dos músculos que não apareceram na janela carregada.
   *
   * Só roda pra quem ficou sem data, e a consulta é enxuta (data + músculos, ordenada, sem as
   * séries): o caso comum — todo mundo treinado nas últimas 12 semanas — não paga nada por isso.
   */
  private async completarUltimoTreino(userId: string, muscles: MuscleLoad[], faltando: GymMuscleKey[], today: string) {
    const series = await this.prisma.gymSet.findMany({
      where: {
        session: { userId, finishedAt: { not: null } },
        completed: true,
        OR: [
          { exercise: { primaryMuscle: { in: faltando as never[] } } },
          { exercise: { secondaryMuscles: { hasSome: faltando as never[] } } },
        ],
      },
      orderBy: { session: { startedAt: "desc" } },
      select: { session: { select: { startedAt: true } }, exercise: { select: { primaryMuscle: true, secondaryMuscles: true } } },
    });

    const pendentes = new Set(faltando);
    for (const s of series) {
      if (pendentes.size === 0) break;
      const alvos = [s.exercise.primaryMuscle, ...s.exercise.secondaryMuscles] as GymMuscleKey[];
      for (const alvo of alvos) {
        if (!pendentes.has(alvo)) continue;
        const m = muscles.find((x) => x.muscle === alvo)!;
        m.lastTrainedAt = diaNoBrasil(s.session.startedAt);
        m.daysSince = diasEntre(m.lastTrainedAt, today);
        pendentes.delete(alvo);
      }
    }
  }

  /** Volume semanal por músculo, das 12 últimas semanas. Semana começa no domingo, como o resto do
   *  módulo (a tirinha da Home e o calendário). */
  private evolucao(entradas: MuscleSetInput[], today: string) {
    const inicio = domingoDaSemana(shift(today, -(SEMANAS_DE_PROGRESSAO * 7 - 1)));
    const porMusculo = new Map<string, Map<string, MuscleWeekPoint>>();

    for (const e of entradas) {
      if (e.date < inicio) continue;
      const semana = domingoDaSemana(e.date);
      const alvos: [GymMuscleKey, number][] = [
        [e.primaryMuscle, 1],
        ...e.secondaryMuscles.filter((m) => m !== e.primaryMuscle).map((m) => [m, 0.5] as [GymMuscleKey, number]),
      ];

      for (const [muscle, peso] of alvos) {
        const semanas = porMusculo.get(muscle) ?? new Map<string, MuscleWeekPoint>();
        const ponto = semanas.get(semana) ?? { week: semana, volume: 0, sets: 0, topWeight: 0 };
        ponto.volume += e.weight * e.reps;
        ponto.sets += peso;
        if (e.weight > ponto.topWeight) ponto.topWeight = e.weight;
        semanas.set(semana, ponto);
        porMusculo.set(muscle, semanas);
      }
    }

    const saida: Record<string, MuscleWeekPoint[]> = {};
    for (const [muscle, semanas] of porMusculo) {
      saida[muscle] = [...semanas.values()]
        .map((p) => ({ ...p, volume: Math.round(p.volume * 100) / 100, sets: Math.round(p.sets * 100) / 100 }))
        .sort((a, b) => a.week.localeCompare(b.week));
    }
    return saida;
  }
}

/**
 * O dia de calendário **no Brasil** de um instante.
 *
 * Nem UTC nem a hora local do servidor servem: a API roda em UTC, e um treino que começou às 22h de
 * Brasília é 01h do dia seguinte em UTC — ele apareceria no dia errado do mapa, e um treino de
 * domingo à noite cairia na semana seguinte do gráfico. É a mesma regra que a liquidação da renda
 * fixa e o registro dos índices já seguem.
 */
const DIA_BR = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

function diaNoBrasil(date: Date): string {
  return DIA_BR.format(date);
}

function noon(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12));
}

function shift(iso: string, days: number): string {
  const d = noon(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diasEntre(from: string, to: string): number {
  return Math.round((noon(to).getTime() - noon(from).getTime()) / 86_400_000);
}

function domingoDaSemana(iso: string): string {
  const d = noon(iso);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}
