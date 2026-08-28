import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { estimateWorkoutSeconds } from "../domain/session-metrics";
import { prefillSets } from "../domain/set-prefill";
import { CreateGymWorkoutDto, UpdateGymWorkoutDto, WorkoutExerciseDto } from "./dto/gym.dto";
import { GymProfileService } from "./gym-profile.service";

@Injectable()
export class GymWorkoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: GymProfileService,
  ) {}

  /** As fichas com o resumo que o card mostra: grupos, exercícios, séries, última vez, tempo médio. */
  async list(userId: string) {
    const fichas = await this.prisma.gymWorkout.findMany({
      where: { userId, archivedAt: null },
      orderBy: { order: "asc" },
      include: {
        exercises: {
          orderBy: { order: "asc" },
          include: { exercise: { select: { id: true, name: true, primaryMuscle: true } } },
        },
      },
    });

    // Uma consulta pras últimas execuções de todas as fichas, não uma por ficha.
    const execucoes = await this.prisma.gymSession.groupBy({
      by: ["workoutId"],
      where: { userId, workoutId: { in: fichas.map((f) => f.id) }, finishedAt: { not: null } },
      _max: { startedAt: true },
      _avg: { durationSeconds: true },
      _count: { _all: true },
    });
    const porFicha = new Map(execucoes.map((e) => [e.workoutId!, e]));

    return fichas.map((f) => {
      const stats = porFicha.get(f.id);
      return {
        ...this.present(f),
        lastPerformedAt: stats?._max.startedAt ?? null,
        timesPerformed: stats?._count._all ?? 0,
        averageDurationSeconds: stats?._avg.durationSeconds ? Math.round(stats._avg.durationSeconds) : null,
      };
    });
  }

  async findOne(userId: string, id: string) {
    const ficha = await this.prisma.gymWorkout.findFirst({
      where: { id, userId, archivedAt: null },
      include: {
        exercises: {
          orderBy: { order: "asc" },
          include: { exercise: true },
        },
      },
    });
    if (!ficha) throw new NotFoundException("Treino não encontrado.");
    return this.present(ficha);
  }

  async create(userId: string, dto: CreateGymWorkoutDto) {
    const perfil = await this.profiles.ensure(userId);
    const ultima = await this.prisma.gymWorkout.findFirst({
      where: { userId, archivedAt: null },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const ficha = await this.prisma.gymWorkout.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        restBetweenExercisesSeconds: dto.restBetweenExercisesSeconds,
        notes: dto.notes,
        order: (ultima?.order ?? -1) + 1,
        exercises: {
          create: (dto.exercises ?? []).map((e, i) => this.exerciseData(e, i, perfil.defaultRestSeconds)),
        },
      },
    });
    return this.findOne(userId, ficha.id);
  }

  async update(userId: string, id: string, dto: UpdateGymWorkoutDto) {
    await this.getOwned(userId, id);
    const perfil = await this.profiles.ensure(userId);
    const { exercises, ...resto } = dto;

    await this.prisma.$transaction(async (tx) => {
      await tx.gymWorkout.update({ where: { id }, data: resto });
      if (!exercises) return;
      // Substituição inteira: a tela de montagem manda a lista final, e reconciliar item a item
      // (com ordem arrastável, item novo e item removido no mesmo salvamento) daria muito mais
      // chance de erro do que apagar e recriar dentro da mesma transação.
      await tx.gymWorkoutExercise.deleteMany({ where: { workoutId: id } });
      for (const [i, e] of exercises.entries()) {
        await tx.gymWorkoutExercise.create({
          data: { workoutId: id, ...this.exerciseData(e, i, perfil.defaultRestSeconds) },
        });
      }
    });

    return this.findOne(userId, id);
  }

  /** Arquiva. As sessões antigas apontam pra ficha e não podem perder o vínculo. */
  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);
    await this.prisma.gymWorkout.update({ where: { id }, data: { archivedAt: new Date() } });
    return { id };
  }

  async duplicate(userId: string, id: string) {
    const original = await this.prisma.gymWorkout.findFirst({
      where: { id, userId, archivedAt: null },
      include: { exercises: { orderBy: { order: "asc" } } },
    });
    if (!original) throw new NotFoundException("Treino não encontrado.");

    const ultima = await this.prisma.gymWorkout.findFirst({
      where: { userId, archivedAt: null },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const copia = await this.prisma.gymWorkout.create({
      data: {
        userId,
        name: `${original.name} (cópia)`,
        description: original.description,
        restBetweenExercisesSeconds: original.restBetweenExercisesSeconds,
        notes: original.notes,
        order: (ultima?.order ?? -1) + 1,
        exercises: {
          create: original.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            order: e.order,
            sets: e.sets,
            targetRepsMin: e.targetRepsMin,
            targetRepsMax: e.targetRepsMax,
            targetWeight: e.targetWeight,
            restSeconds: e.restSeconds,
            notes: e.notes,
          })),
        },
      },
    });
    return this.findOne(userId, copia.id);
  }

  /** Reordena as fichas. A ordem chega inteira, então uma passada resolve. */
  async reorder(userId: string, ids: string[]) {
    const minhas = await this.prisma.gymWorkout.findMany({
      where: { userId, archivedAt: null, id: { in: ids } },
      select: { id: true },
    });
    const validos = new Set(minhas.map((f) => f.id));

    await this.prisma.$transaction(
      ids.filter((id) => validos.has(id)).map((id, i) =>
        this.prisma.gymWorkout.update({ where: { id }, data: { order: i } }),
      ),
    );
    return this.list(userId);
  }

  /**
   * Tudo que o modo treino precisa pra rodar OFFLINE do começo ao fim.
   *
   * Vai numa requisição só, feita ANTES de começar: o plano, o descanso de cada exercício e o que
   * foi feito da última vez em cada um. Depois disso o aparelho não precisa mais do servidor até a
   * hora de subir a sessão — que é exatamente o que o §38 pede.
   */
  async prefill(userId: string, id: string) {
    const ficha = await this.findOne(userId, id);
    const exerciseIds = ficha.exercises.map((e: { exerciseId: string }) => e.exerciseId);

    // A última sessão CONCLUÍDA em que cada exercício apareceu — pode ser de fichas diferentes, e
    // é isso mesmo: o corpo não sabe de qual ficha veio a carga.
    const ultimasSeries = await this.prisma.gymSet.findMany({
      where: { exerciseId: { in: exerciseIds }, session: { userId, finishedAt: { not: null } }, completed: true },
      orderBy: { completedAt: "desc" },
      take: 600,
      select: { exerciseId: true, setNumber: true, weight: true, reps: true, sessionId: true, completedAt: true },
    });

    const fotos = await this.prisma.gymExercisePhoto.findMany({
      where: { userId, exerciseId: { in: exerciseIds } },
      select: { exerciseId: true, image: true },
    });
    const fotoPorId = new Map(fotos.map((f) => [f.exerciseId, f.image]));

    const ultimaSessaoPorExercicio = new Map<string, string>();
    for (const s of ultimasSeries) {
      if (!ultimaSessaoPorExercicio.has(s.exerciseId)) ultimaSessaoPorExercicio.set(s.exerciseId, s.sessionId);
    }

    return {
      workout: ficha,
      exercises: ficha.exercises.map((e: any) => {
        const sessaoAlvo = ultimaSessaoPorExercicio.get(e.exerciseId);
        const anteriores = ultimasSeries
          .filter((s) => s.exerciseId === e.exerciseId && s.sessionId === sessaoAlvo)
          .map((s) => ({ setNumber: s.setNumber, weight: Number(s.weight), reps: s.reps }))
          .sort((a, b) => a.setNumber - b.setNumber);

        return {
          workoutExerciseId: e.id,
          exerciseId: e.exerciseId,
          name: e.exercise.name,
          primaryMuscle: e.exercise.primaryMuscle,
          equipment: e.exercise.equipment,
          image: fotoPorId.get(e.exerciseId) ?? e.exercise.image ?? null,
          order: e.order,
          targetSets: e.sets,
          targetRepsMin: e.targetRepsMin,
          targetRepsMax: e.targetRepsMax,
          restSeconds: e.restSeconds,
          notes: e.notes,
          lastSets: anteriores,
          sets: prefillSets(
            {
              exerciseId: e.exerciseId,
              sets: e.sets,
              targetRepsMin: e.targetRepsMin,
              targetRepsMax: e.targetRepsMax,
              targetWeight: e.targetWeight,
              restSeconds: e.restSeconds,
            },
            anteriores,
          ),
        };
      }),
    };
  }

  private exerciseData(e: WorkoutExerciseDto, index: number, defaultRest: number) {
    const min = e.targetRepsMin ?? 8;
    const max = e.targetRepsMax ?? Math.max(min, 12);
    return {
      exerciseId: e.exerciseId,
      order: index,
      sets: e.sets ?? 3,
      targetRepsMin: Math.min(min, max),
      targetRepsMax: Math.max(min, max),
      targetWeight: e.targetWeight ?? null,
      // Herda o padrão do perfil (§33) quando a tela não mandou um.
      restSeconds: e.restSeconds ?? defaultRest,
      notes: e.notes ?? null,
    };
  }

  private present(ficha: any) {
    const exercicios = ficha.exercises ?? [];
    const musculos: string[] = [];
    for (const e of exercicios) {
      const m = e.exercise.primaryMuscle;
      if (!musculos.includes(m)) musculos.push(m);
    }
    return {
      id: ficha.id,
      name: ficha.name,
      description: ficha.description,
      notes: ficha.notes,
      order: ficha.order,
      restBetweenExercisesSeconds: ficha.restBetweenExercisesSeconds,
      muscles: musculos,
      exerciseCount: exercicios.length,
      totalSets: exercicios.reduce((acc: number, e: any) => acc + e.sets, 0),
      estimatedSeconds: estimateWorkoutSeconds(
        exercicios.map((e: any) => ({
          sets: e.sets,
          targetRepsMin: e.targetRepsMin,
          targetRepsMax: e.targetRepsMax,
          restSeconds: e.restSeconds,
        })),
        ficha.restBetweenExercisesSeconds,
      ),
      exercises: exercicios.map((e: any) => ({
        id: e.id,
        exerciseId: e.exerciseId,
        order: e.order,
        sets: e.sets,
        targetRepsMin: e.targetRepsMin,
        targetRepsMax: e.targetRepsMax,
        targetWeight: e.targetWeight === null ? null : Number(e.targetWeight),
        restSeconds: e.restSeconds,
        notes: e.notes,
        exercise: e.exercise,
      })),
    };
  }

  private async getOwned(userId: string, id: string) {
    const ficha = await this.prisma.gymWorkout.findFirst({ where: { id, userId, archivedAt: null } });
    if (!ficha) throw new NotFoundException("Treino não encontrado.");
    return ficha;
  }
}
