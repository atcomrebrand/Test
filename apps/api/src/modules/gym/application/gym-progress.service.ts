import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { parseAssetPhoto } from "../../financings/domain/asset-photo";
import { bucketSessions, consistencyPercent, startOfWeek, summarizeWeek, targetProgress, weekDays } from "../domain/progress-series";
import { CreateGymPhotoDto, CreateGymTargetDto, UpdateGymTargetDto, UpsertGymMeasurementDto } from "./dto/gym.dto";
import { GymProfileService } from "./gym-profile.service";
import { GymWorkoutsService } from "./gym-workouts.service";

export type ProgressRange = "WEEK" | "MONTH" | "M3" | "M6" | "YEAR";

const DIAS_DA_JANELA: Record<ProgressRange, number> = { WEEK: 7, MONTH: 30, M3: 90, M6: 180, YEAR: 365 };

@Injectable()
export class GymProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profiles: GymProfileService,
    private readonly workouts: GymWorkoutsService,
  ) {}

  /**
   * A tela inicial do módulo, numa requisição só.
   *
   * São seis blocos que vêm de tabelas diferentes; buscá-los em seis chamadas deixaria a Home
   * piscando em pedaços numa conexão de academia. O custo real é ir ao banco, não somar.
   */
  async home(userId: string, range: ProgressRange = "MONTH") {
    const agora = new Date();
    const [perfil, fichas, sessoes, recordes] = await Promise.all([
      this.profiles.ensure(userId),
      this.workouts.list(userId),
      this.prisma.gymSession.findMany({
        where: { userId, finishedAt: { not: null } },
        orderBy: { startedAt: "desc" },
        take: 200,
        select: { id: true, name: true, startedAt: true, durationSeconds: true, totalVolume: true, workoutId: true },
      }),
      this.prisma.gymPersonalRecord.findMany({
        where: { userId },
        orderBy: { achievedAt: "desc" },
        take: 6,
        include: { exercise: { select: { id: true, name: true } } },
      }),
    ]);

    const pontos = sessoes.map((s) => ({
      startedAt: s.startedAt,
      totalVolume: s.totalVolume === null ? 0 : Number(s.totalVolume),
      durationSeconds: s.durationSeconds,
    }));

    const ultima = sessoes[0] ?? null;
    const exerciciosDaUltima = ultima
      ? await this.prisma.gymSet.findMany({ where: { sessionId: ultima.id }, select: { exerciseId: true } })
      : [];

    return {
      profile: perfil,
      onboarded: perfil.onboardedAt !== null,
      /** O treino de hoje: o que está há mais tempo sem ser feito, respeitando a ordem da lista. */
      nextWorkout: this.pickNextWorkout(fichas),
      week: summarizeWeek(pontos, agora, perfil.weeklyTarget),
      /** Os sete dias da semana corrente, pra tirinha Dom→Sáb. Mesmo corte da contagem acima. */
      weekDays: weekDays(pontos, agora),
      volumeSeries: this.volumeSeries(pontos, range, agora),
      lastSession: ultima
        ? {
            id: ultima.id,
            name: ultima.name,
            startedAt: ultima.startedAt,
            durationSeconds: ultima.durationSeconds,
            totalVolume: ultima.totalVolume === null ? 0 : Number(ultima.totalVolume),
            exerciseCount: new Set(exerciciosDaUltima.map((e) => e.exerciseId)).size,
          }
        : null,
      recentRecords: recordes.map((r) => ({
        id: r.id,
        kind: r.kind,
        exerciseName: r.exercise.name,
        exerciseId: r.exerciseId,
        weight: Number(r.weight),
        reps: r.reps,
        improvement: r.improvement === null ? null : Number(r.improvement),
        achievedAt: r.achievedAt,
      })),
      workoutCount: fichas.length,
    };
  }

  /**
   * Os dias com treino de um mês, pro calendário.
   *
   * Só as datas e o que aconteceu nelas — o calendário não precisa da sessão inteira, e mandar
   * menos é o que deixa trocar de mês custar quase nada.
   */
  async calendar(userId: string, year: number, month: number) {
    const inicio = new Date(Date.UTC(year, month - 1, 1));
    const fim = new Date(Date.UTC(year, month, 1));

    const sessoes = await this.prisma.gymSession.findMany({
      where: { userId, finishedAt: { not: null }, startedAt: { gte: inicio, lt: fim } },
      orderBy: { startedAt: "asc" },
      select: { id: true, name: true, startedAt: true, durationSeconds: true, totalVolume: true },
    });

    const porDia = new Map<string, { date: string; sessions: number; volume: number; minutes: number; names: string[] }>();
    for (const s of sessoes) {
      const key = s.startedAt.toISOString().slice(0, 10);
      const atual = porDia.get(key) ?? { date: key, sessions: 0, volume: 0, minutes: 0, names: [] };
      atual.sessions += 1;
      atual.volume = Math.round((atual.volume + (s.totalVolume === null ? 0 : Number(s.totalVolume))) * 100) / 100;
      atual.minutes += Math.round((s.durationSeconds ?? 0) / 60);
      if (!atual.names.includes(s.name)) atual.names.push(s.name);
      porDia.set(key, atual);
    }

    return { year, month, days: [...porDia.values()] };
  }

  /** Dashboard de performance (§46). */
  async progress(userId: string, range: ProgressRange = "M3") {
    const agora = new Date();
    const desde = new Date(agora.getTime() - DIAS_DA_JANELA[range] * 86400000);
    const perfil = await this.profiles.ensure(userId);

    const [sessoes, medidas, totais, descanso, recordes] = await Promise.all([
      this.prisma.gymSession.findMany({
        where: { userId, finishedAt: { not: null }, startedAt: { gte: desde } },
        orderBy: { startedAt: "asc" },
        select: { startedAt: true, durationSeconds: true, totalVolume: true },
      }),
      this.prisma.gymMeasurement.findMany({
        where: { userId, date: { gte: desde }, weightKg: { not: null } },
        orderBy: { date: "asc" },
        select: { date: true, weightKg: true },
      }),
      this.prisma.gymSession.aggregate({
        where: { userId, finishedAt: { not: null } },
        _count: { _all: true },
        _sum: { durationSeconds: true, totalVolume: true },
        _avg: { durationSeconds: true },
      }),
      this.prisma.gymSet.aggregate({
        where: { session: { userId, finishedAt: { not: null } }, restActualSeconds: { not: null } },
        _avg: { restActualSeconds: true },
        _sum: { restActualSeconds: true },
      }),
      this.prisma.gymPersonalRecord.count({ where: { userId } }),
    ]);

    const pontos = sessoes.map((s) => ({
      startedAt: s.startedAt,
      totalVolume: s.totalVolume === null ? 0 : Number(s.totalVolume),
      durationSeconds: s.durationSeconds,
    }));
    const bucket = range === "WEEK" || range === "MONTH" ? "WEEK" : range === "YEAR" ? "MONTH" : "WEEK";
    const semanas = bucketSessions(pontos, bucket, desde, agora);

    return {
      range,
      volumeSeries: semanas.map((b) => ({ date: b.key, value: b.volume })),
      frequencySeries: semanas.map((b) => ({ date: b.key, value: b.sessions })),
      durationSeries: semanas.map((b) => ({ date: b.key, value: b.minutes })),
      bodyWeightSeries: medidas.map((m) => ({ date: m.date.toISOString().slice(0, 10), value: Number(m.weightKg) })),
      totals: {
        sessions: totais._count._all,
        volume: totais._sum.totalVolume === null ? 0 : Number(totais._sum.totalVolume),
        minutes: Math.round((totais._sum.durationSeconds ?? 0) / 60),
        averageMinutes: totais._avg.durationSeconds ? Math.round(totais._avg.durationSeconds / 60) : null,
        averageRestSeconds: descanso._avg.restActualSeconds ? Math.round(descanso._avg.restActualSeconds) : null,
        totalRestMinutes: Math.round((descanso._sum.restActualSeconds ?? 0) / 60),
        records: recordes,
        consistencyPercent: consistencyPercent(semanas, perfil.weeklyTarget, startOfWeek(agora).toISOString().slice(0, 10)),
      },
    };
  }

  // -------------------------------------------------------------------------
  // Medidas
  // -------------------------------------------------------------------------

  listMeasurements(userId: string) {
    return this.prisma.gymMeasurement.findMany({ where: { userId }, orderBy: { date: "desc" } });
  }

  /**
   * Uma medição por dia: remedir o braço à tarde substitui a da manhã em vez de virar dois pontos
   * no gráfico do mesmo dia.
   */
  async upsertMeasurement(userId: string, dto: UpsertGymMeasurementDto) {
    const { date, custom, ...resto } = dto;
    const dia = new Date(date);
    return this.prisma.gymMeasurement.upsert({
      where: { userId_date: { userId, date: dia } },
      create: { userId, date: dia, ...resto, custom: custom ?? undefined },
      update: { ...resto, custom: custom ?? undefined },
    });
  }

  async removeMeasurement(userId: string, id: string) {
    const m = await this.prisma.gymMeasurement.findFirst({ where: { id, userId }, select: { id: true } });
    if (!m) throw new NotFoundException("Medição não encontrada.");
    await this.prisma.gymMeasurement.delete({ where: { id } });
    return { id };
  }

  // -------------------------------------------------------------------------
  // Fotos
  // -------------------------------------------------------------------------

  listPhotos(userId: string) {
    return this.prisma.gymPhoto.findMany({ where: { userId }, orderBy: { date: "desc" } });
  }

  async createPhoto(userId: string, dto: CreateGymPhotoDto) {
    // A validação é do servidor, não do canvas do cliente: chamada direta na API não passa pelo
    // redimensionamento. SVG fica de fora mesmo sendo "imagem" — é documento que executa script, e
    // a foto volta pra tela dentro de um `<img src>`.
    const result = parseAssetPhoto(dto.image);
    if (!result.ok) throw new BadRequestException(result.reason);

    return this.prisma.gymPhoto.create({
      data: { userId, date: new Date(dto.date), pose: dto.pose, image: dto.image, notes: dto.notes },
    });
  }

  async removePhoto(userId: string, id: string) {
    const p = await this.prisma.gymPhoto.findFirst({ where: { id, userId }, select: { id: true } });
    if (!p) throw new NotFoundException("Foto não encontrada.");
    await this.prisma.gymPhoto.delete({ where: { id } });
    return { id };
  }

  // -------------------------------------------------------------------------
  // Metas e recordes
  // -------------------------------------------------------------------------

  async listTargets(userId: string) {
    const metas = await this.prisma.gymTarget.findMany({
      where: { userId },
      orderBy: [{ achievedAt: "asc" }, { createdAt: "desc" }],
      include: { exercise: { select: { id: true, name: true } } },
    });

    const atuais = await Promise.all(metas.map((m) => this.currentValueOf(userId, m)));

    return metas.map((m, i) => {
      const atual = atuais[i];
      const alvo = Number(m.targetValue);
      const partida = m.startValue === null ? null : Number(m.startValue);
      return {
        id: m.id,
        kind: m.kind,
        label: m.label,
        exerciseId: m.exerciseId,
        exerciseName: m.exercise?.name ?? null,
        targetValue: alvo,
        startValue: partida,
        currentValue: atual,
        progressPercent: atual === null ? 0 : targetProgress(atual, alvo, partida),
        deadline: m.deadline,
        achievedAt: m.achievedAt,
      };
    });
  }

  async createTarget(userId: string, dto: CreateGymTargetDto) {
    if (dto.kind === "CARGA" && !dto.exerciseId) {
      throw new BadRequestException("Meta de carga precisa de um exercício.");
    }
    return this.prisma.gymTarget.create({
      data: {
        userId,
        kind: dto.kind,
        exerciseId: dto.exerciseId ?? null,
        label: dto.label,
        targetValue: dto.targetValue,
        startValue: dto.startValue ?? null,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
      },
    });
  }

  async updateTarget(userId: string, id: string, dto: UpdateGymTargetDto) {
    const meta = await this.prisma.gymTarget.findFirst({ where: { id, userId }, select: { id: true } });
    if (!meta) throw new NotFoundException("Meta não encontrada.");
    const { achieved, deadline, ...resto } = dto;
    return this.prisma.gymTarget.update({
      where: { id },
      data: {
        ...resto,
        ...(deadline !== undefined ? { deadline: new Date(deadline) } : {}),
        ...(achieved !== undefined ? { achievedAt: achieved ? new Date() : null } : {}),
      },
    });
  }

  async removeTarget(userId: string, id: string) {
    const meta = await this.prisma.gymTarget.findFirst({ where: { id, userId }, select: { id: true } });
    if (!meta) throw new NotFoundException("Meta não encontrada.");
    await this.prisma.gymTarget.delete({ where: { id } });
    return { id };
  }

  async listRecords(userId: string) {
    const recordes = await this.prisma.gymPersonalRecord.findMany({
      where: { userId },
      orderBy: { achievedAt: "desc" },
      take: 100,
      include: { exercise: { select: { id: true, name: true, primaryMuscle: true } } },
    });
    return recordes.map((r) => ({
      id: r.id,
      kind: r.kind,
      exerciseId: r.exerciseId,
      exerciseName: r.exercise.name,
      primaryMuscle: r.exercise.primaryMuscle,
      weight: Number(r.weight),
      reps: r.reps,
      estimatedOneRm: r.estimatedOneRm === null ? null : Number(r.estimatedOneRm),
      improvement: r.improvement === null ? null : Number(r.improvement),
      achievedAt: r.achievedAt,
      sessionId: r.sessionId,
    }));
  }

  // -------------------------------------------------------------------------

  /** O valor de hoje de uma meta sai do dado real, nunca de um campo que envelhece sozinho. */
  private async currentValueOf(userId: string, meta: { kind: string; exerciseId: string | null }): Promise<number | null> {
    if (meta.kind === "CARGA" && meta.exerciseId) {
      const max = await this.prisma.gymSet.aggregate({
        where: { exerciseId: meta.exerciseId, completed: true, session: { userId, finishedAt: { not: null } } },
        _max: { weight: true },
      });
      return max._max.weight === null ? null : Number(max._max.weight);
    }
    if (meta.kind === "PESO_CORPORAL") {
      const ultima = await this.prisma.gymMeasurement.findFirst({
        where: { userId, weightKg: { not: null } },
        orderBy: { date: "desc" },
        select: { weightKg: true },
      });
      return ultima?.weightKg === null || ultima?.weightKg === undefined ? null : Number(ultima.weightKg);
    }
    // Frequência: treinos da semana corrente.
    const inicio = startOfWeek(new Date());
    return this.prisma.gymSession.count({ where: { userId, finishedAt: { not: null }, startedAt: { gte: inicio } } });
  }

  /**
   * O "treino de hoje".
   *
   * Quem nunca foi feito vem primeiro, na ordem da lista; depois, o que está há mais tempo parado.
   * É a regra que faz um ABCD rodar sozinho sem a pessoa precisar marcar nada — e sem inventar um
   * calendário fixo, que quebraria na primeira semana em que ela treinasse num dia diferente.
   */
  private pickNextWorkout(fichas: any[]) {
    if (fichas.length === 0) return null;
    const nunca = fichas.filter((f) => !f.lastPerformedAt).sort((a, b) => a.order - b.order);
    if (nunca.length > 0) return nunca[0];
    return [...fichas].sort((a, b) => new Date(a.lastPerformedAt).getTime() - new Date(b.lastPerformedAt).getTime())[0];
  }

  private volumeSeries(pontos: { startedAt: Date; totalVolume: number; durationSeconds: number | null }[], range: ProgressRange, agora: Date) {
    const desde = new Date(agora.getTime() - DIAS_DA_JANELA[range] * 86400000);
    const bucket = range === "YEAR" || range === "M6" ? "MONTH" : "WEEK";
    return bucketSessions(pontos.filter((p) => p.startedAt >= desde), bucket, desde, agora).map((b) => ({
      date: b.key,
      value: b.volume,
      sessions: b.sessions,
    }));
  }
}
