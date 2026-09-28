import { Injectable, NotFoundException } from "@nestjs/common";
import { GymRecordKind } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { detectRecords, PreviousBest } from "../domain/personal-records";
import { estimateOneRm } from "../domain/one-rm";
import { SetLike, summarizeSession } from "../domain/session-metrics";
import { SyncGymSessionDto } from "./dto/gym.dto";
import { GymProfileService } from "./gym-profile.service";

@Injectable()
export class GymSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: GymProfileService,
  ) {}

  /**
   * Sobe uma sessão inteira, criada e vivida no aparelho.
   *
   * Idempotente pelo `clientId`: reenviar a mesma sessão atualiza a existente. É o que sustenta o
   * offline — o app pode tentar subir quantas vezes precisar, na volta da rede, no reload, no
   * próximo abrir, sem risco de o histórico encher de treinos repetidos.
   *
   * As séries são regravadas por completo a cada subida, porque a fonte de verdade enquanto o treino
   * acontece é o aparelho, não o servidor: uma sessão parcial subida no meio e completada depois
   * tem que acabar exatamente igual ao que está na tela de quem treinou.
   *
   * Os recordes só são detectados quando a sessão é FINALIZADA, e só uma vez: subir de novo uma
   * sessão já finalizada não dispara troféu repetido.
   */
  async sync(userId: string, dto: SyncGymSessionDto) {
    const perfil = await this.profiles.ensure(userId);
    const inicio = new Date(dto.startedAt);
    const fim = dto.finishedAt ? new Date(dto.finishedAt) : null;

    const existente = await this.prisma.gymSession.findUnique({
      where: { clientId: dto.clientId },
      select: { id: true, userId: true, finishedAt: true },
    });
    // Um clientId de outra conta nunca é atualizado: seria escrita cruzada entre usuários.
    if (existente && existente.userId !== userId) throw new NotFoundException("Sessão não encontrada.");
    const jaEstavaFinalizada = !!existente?.finishedAt;

    const series: SetLike[] = dto.sets.map((s) => ({
      exerciseId: s.exerciseId,
      setNumber: s.setNumber,
      weight: s.weight,
      reps: s.reps,
      completed: s.completed ?? true,
      restSeconds: s.restSeconds ?? null,
      restActualSeconds: s.restActualSeconds ?? null,
      restWasSkipped: s.restWasSkipped ?? false,
    }));
    const metrics = summarizeSession(series, inicio, fim);

    // A ficha precisa ser da própria pessoa; um id chutado não pode vincular a sessão a outra conta.
    const workoutId = dto.workoutId
      ? (await this.prisma.gymWorkout.findFirst({ where: { id: dto.workoutId, userId }, select: { id: true } }))?.id ?? null
      : null;

    const sessao = await this.prisma.$transaction(async (tx) => {
      const s = await tx.gymSession.upsert({
        where: { clientId: dto.clientId },
        create: {
          userId,
          clientId: dto.clientId,
          workoutId,
          name: dto.name,
          startedAt: inicio,
          finishedAt: fim,
          durationSeconds: metrics.durationSeconds,
          totalVolume: metrics.totalVolume,
          notes: dto.notes,
        },
        update: {
          workoutId,
          name: dto.name,
          startedAt: inicio,
          finishedAt: fim,
          durationSeconds: metrics.durationSeconds,
          totalVolume: metrics.totalVolume,
          notes: dto.notes,
        },
      });

      await tx.gymSet.deleteMany({ where: { sessionId: s.id } });
      for (const set of dto.sets) {
        await tx.gymSet.create({
          data: {
            sessionId: s.id,
            exerciseId: set.exerciseId,
            exerciseOrder: set.exerciseOrder ?? 0,
            setNumber: set.setNumber,
            weight: set.weight,
            reps: set.reps,
            completed: set.completed ?? true,
            notes: set.notes,
            restSeconds: set.restSeconds ?? null,
            restStartedAt: set.restStartedAt ? new Date(set.restStartedAt) : null,
            restEndedAt: set.restEndedAt ? new Date(set.restEndedAt) : null,
            restActualSeconds: set.restActualSeconds ?? null,
            restWasPaused: set.restWasPaused ?? false,
            restWasSkipped: set.restWasSkipped ?? false,
            restAdjustmentSeconds: set.restAdjustmentSeconds ?? 0,
            completedAt: set.completedAt ? new Date(set.completedAt) : new Date(),
          },
        });
      }
      return s;
    });

    const records = fim && !jaEstavaFinalizada
      ? await this.registerRecords(userId, sessao.id, series, perfil.oneRmFormula)
      : [];

    return { ...(await this.findOne(userId, sessao.id)), newRecords: records };
  }

  async list(userId: string, from?: string, to?: string) {
    const sessoes = await this.prisma.gymSession.findMany({
      where: {
        userId,
        finishedAt: { not: null },
        ...(from || to
          ? { startedAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
          : {}),
      },
      orderBy: { startedAt: "desc" },
      take: 300,
      include: { _count: { select: { sets: true } }, sets: { select: { exerciseId: true } } },
    });

    return sessoes.map((s) => ({
      id: s.id,
      name: s.name,
      workoutId: s.workoutId,
      startedAt: s.startedAt,
      finishedAt: s.finishedAt,
      durationSeconds: s.durationSeconds,
      totalVolume: s.totalVolume === null ? 0 : Number(s.totalVolume),
      setCount: s._count.sets,
      exerciseCount: new Set(s.sets.map((x) => x.exerciseId)).size,
    }));
  }

  async findOne(userId: string, id: string) {
    const sessao = await this.prisma.gymSession.findFirst({
      where: { id, userId },
      include: {
        sets: { orderBy: [{ exerciseOrder: "asc" }, { setNumber: "asc" }], include: { exercise: { select: { id: true, name: true, primaryMuscle: true, equipment: true } } } },
        records: { include: { exercise: { select: { id: true, name: true } } } },
      },
    });
    if (!sessao) throw new NotFoundException("Sessão não encontrada.");

    const series: SetLike[] = sessao.sets.map((s) => ({
      exerciseId: s.exerciseId,
      setNumber: s.setNumber,
      weight: Number(s.weight),
      reps: s.reps,
      completed: s.completed,
      restSeconds: s.restSeconds,
      restActualSeconds: s.restActualSeconds,
      restWasSkipped: s.restWasSkipped,
    }));

    // Agrupa por exercício, que é como a tela de detalhe mostra.
    const porExercicio = new Map<string, { exercise: any; order: number; sets: any[] }>();
    for (const s of sessao.sets) {
      const atual = porExercicio.get(s.exerciseId) ?? { exercise: s.exercise, order: s.exerciseOrder, sets: [] };
      atual.sets.push({
        id: s.id,
        setNumber: s.setNumber,
        weight: Number(s.weight),
        reps: s.reps,
        completed: s.completed,
        notes: s.notes,
        restSeconds: s.restSeconds,
        restActualSeconds: s.restActualSeconds,
        restWasPaused: s.restWasPaused,
        restWasSkipped: s.restWasSkipped,
      });
      porExercicio.set(s.exerciseId, atual);
    }

    return {
      id: sessao.id,
      clientId: sessao.clientId,
      name: sessao.name,
      workoutId: sessao.workoutId,
      startedAt: sessao.startedAt,
      finishedAt: sessao.finishedAt,
      notes: sessao.notes,
      metrics: summarizeSession(series, sessao.startedAt, sessao.finishedAt),
      exercises: [...porExercicio.values()].sort((a, b) => a.order - b.order),
      records: sessao.records.map((r) => ({
        id: r.id,
        kind: r.kind,
        exerciseId: r.exerciseId,
        exerciseName: r.exercise.name,
        weight: Number(r.weight),
        reps: r.reps,
        estimatedOneRm: r.estimatedOneRm === null ? null : Number(r.estimatedOneRm),
        improvement: r.improvement === null ? null : Number(r.improvement),
        achievedAt: r.achievedAt,
      })),
    };
  }

  async remove(userId: string, id: string) {
    const sessao = await this.prisma.gymSession.findFirst({ where: { id, userId }, select: { id: true } });
    if (!sessao) throw new NotFoundException("Sessão não encontrada.");
    await this.prisma.$transaction([
      // O vínculo do recorde com a sessão é `SetNull` no schema — o que sozinho deixaria o troféu
      // na tela apontando pra um treino que não existe mais. Recorde é a prova de que algo
      // aconteceu; apagado o treino, some a prova. As séries saem por cascata.
      this.prisma.gymPersonalRecord.deleteMany({ where: { sessionId: id } }),
      this.prisma.gymSession.delete({ where: { id } }),
    ]);
    return { id };
  }

  /**
   * Compara a sessão com o melhor de sempre de cada exercício e grava os recordes novos.
   *
   * O "melhor de sempre" é buscado com agregação no Postgres, não carregando o histórico pra somar
   * em JS — o mesmo motivo do resto do app: a VPS tem 1GB e isso roda ao fim de todo treino.
   */
  private async registerRecords(userId: string, sessionId: string, series: SetLike[], formula: any) {
    const exerciseIds = [...new Set(series.filter((s) => s.completed).map((s) => s.exerciseId))];
    if (exerciseIds.length === 0) return [];

    const [maiores, anteriores] = await Promise.all([
      this.prisma.gymSet.groupBy({
        by: ["exerciseId"],
        where: { exerciseId: { in: exerciseIds }, completed: true, session: { userId, id: { not: sessionId }, finishedAt: { not: null } } },
        _max: { weight: true },
      }),
      this.prisma.gymSet.findMany({
        where: { exerciseId: { in: exerciseIds }, completed: true, session: { userId, id: { not: sessionId }, finishedAt: { not: null } } },
        select: { exerciseId: true, weight: true, reps: true },
        take: 5000,
      }),
    ]);

    const maxPorExercicio = new Map(maiores.map((m) => [m.exerciseId, m._max.weight === null ? null : Number(m._max.weight)]));

    const previous = new Map<string, PreviousBest>();
    for (const exerciseId of exerciseIds) {
      const doExercicio = anteriores.filter((a) => a.exerciseId === exerciseId);
      // Sem histórico: fica FORA do mapa, e `detectRecords` não celebra estreia.
      if (doExercicio.length === 0) continue;

      const maxWeight = maxPorExercicio.get(exerciseId) ?? null;
      const repsNoMax = doExercicio
        .filter((a) => Number(a.weight) === maxWeight)
        .reduce((acc, a) => Math.max(acc, a.reps), 0);

      // `groupBy` não soma peso×reps, então o volume por sessão é montado aqui a partir das
      // linhas cruas — ainda uma consulta indexada por exercício, não a base inteira em memória.
      let maxVolume: number | null = null;
      const porSessao = new Map<string, number>();
      const brutas = await this.prisma.gymSet.findMany({
        where: { exerciseId, completed: true, session: { userId, id: { not: sessionId }, finishedAt: { not: null } } },
        select: { sessionId: true, weight: true, reps: true },
        take: 2000,
      });
      for (const b of brutas) {
        porSessao.set(b.sessionId, (porSessao.get(b.sessionId) ?? 0) + Number(b.weight) * b.reps);
      }
      for (const v of porSessao.values()) maxVolume = maxVolume === null ? v : Math.max(maxVolume, v);

      let maxOneRm: number | null = null;
      for (const a of doExercicio) {
        const est = estimateOneRm(Number(a.weight), a.reps, formula);
        if (est !== null && (maxOneRm === null || est > maxOneRm)) maxOneRm = est;
      }

      previous.set(exerciseId, {
        maxWeight,
        repsAtMaxWeight: repsNoMax || null,
        maxExerciseVolume: maxVolume,
        maxOneRm,
      });
    }

    const detectados = detectRecords(series, previous, formula);
    if (detectados.length === 0) return [];

    const agora = new Date();
    await this.prisma.gymPersonalRecord.createMany({
      data: detectados.map((r) => ({
        userId,
        exerciseId: r.exerciseId,
        sessionId,
        kind: r.kind as GymRecordKind,
        weight: r.weight,
        reps: r.reps,
        estimatedOneRm: r.estimatedOneRm,
        improvement: r.improvement,
        achievedAt: agora,
      })),
    });

    return detectados;
  }
}
