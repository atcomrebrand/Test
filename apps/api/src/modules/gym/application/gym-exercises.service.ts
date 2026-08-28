import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { GymEquipment, GymMuscle, Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { estimateOneRm, OneRmFormula } from "../domain/one-rm";
import { matchesExercise, rankExercises } from "../domain/exercise-search";
// Importado do módulo de financiamentos de propósito: é a MESMA validação de segurança (data URL,
// tipo bitmap, tamanho, SVG barrado), já com specs. Duplicar um validador de segurança é garantir
// que um dos dois fique desatualizado quando o próximo furo aparecer.
import { parseAssetPhoto } from "../../financings/domain/asset-photo";
import { CreateGymExerciseDto, UpdateGymExerciseDto } from "./dto/gym.dto";

export interface ExerciseFilters {
  query?: string;
  muscle?: GymMuscle;
  equipment?: GymEquipment;
  onlyFavorites?: boolean;
}

@Injectable()
export class GymExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * O catálogo global mais os exercícios da própria pessoa.
   *
   * `userId: null` traz o catálogo compartilhado; o `OR` acrescenta os próprios. Ninguém enxerga o
   * exercício criado por outra conta — o filtro é explícito e não depende de nenhuma camada acima.
   */
  async list(userId: string, filters: ExerciseFilters = {}) {
    const [exercicios, favoritos, uso, fotos] = await Promise.all([
      this.prisma.gymExercise.findMany({
        where: { archivedAt: null, OR: [{ userId: null }, { userId }] },
      }),
      this.prisma.gymExerciseFavorite.findMany({ where: { userId }, select: { exerciseId: true } }),
      // "Mais utilizados" sai de uma agregação no Postgres, não de contar em JS: a VPS tem 1GB e
      // esta tela abre a cada visita à biblioteca.
      this.prisma.gymSet.groupBy({
        by: ["exerciseId"],
        where: { session: { userId } },
        _count: { _all: true },
      }),
      this.prisma.gymExercisePhoto.findMany({ where: { userId }, select: { exerciseId: true, image: true } }),
    ]);

    const favoritoIds = new Set(favoritos.map((f) => f.exerciseId));
    const fotoPorId = new Map(fotos.map((f) => [f.exerciseId, f.image]));
    const usoPorId = new Map(uso.map((u) => [u.exerciseId, u._count._all]));

    const filtrados = exercicios.filter((e) =>
      matchesExercise(
        { id: e.id, name: e.name, primaryMuscle: e.primaryMuscle, secondaryMuscles: e.secondaryMuscles, equipment: e.equipment },
        { query: filters.query, muscle: filters.muscle, equipment: filters.equipment, onlyFavorites: filters.onlyFavorites, favoriteIds: favoritoIds },
      ),
    );

    return rankExercises(
      filtrados.map((e) => ({
        ...e,
        // A foto do usuário ganha da do catálogo: ela é a que ele reconhece na academia dele.
        image: fotoPorId.get(e.id) ?? e.image,
        hasUserPhoto: fotoPorId.has(e.id),
        favorite: favoritoIds.has(e.id),
        timesPerformed: usoPorId.get(e.id) ?? 0,
        custom: e.userId !== null,
      })),
      filters.query ?? "",
      usoPorId,
    );
  }

  /** Detalhe + histórico do exercício, que é o que a página dele mostra (§24). */
  async findOne(userId: string, id: string, formula: OneRmFormula = "EPLEY") {
    const exercicio = await this.getVisible(userId, id);

    const [series, favorito, foto] = await Promise.all([
      this.prisma.gymSet.findMany({
        where: { exerciseId: id, completed: true, session: { userId } },
        orderBy: { completedAt: "desc" },
        take: 400,
        include: { session: { select: { id: true, name: true, startedAt: true } } },
      }),
      this.prisma.gymExerciseFavorite.findFirst({ where: { userId, exerciseId: id } }),
      this.prisma.gymExercisePhoto.findUnique({ where: { userId_exerciseId: { userId, exerciseId: id } } }),
    ]);

    // Uma linha por sessão: o histórico da tela é "no dia 27/08 fiz 4 séries de 80 kg × 8", não uma
    // lista de séries soltas que a pessoa teria que somar de cabeça.
    const porSessao = new Map<string, { sessionId: string; date: Date; sets: number; topWeight: number; topReps: number; volume: number }>();
    for (const s of series) {
      const atual = porSessao.get(s.sessionId) ?? {
        sessionId: s.sessionId,
        date: s.session.startedAt,
        sets: 0,
        topWeight: 0,
        topReps: 0,
        volume: 0,
      };
      const peso = Number(s.weight);
      atual.sets += 1;
      atual.volume = Math.round((atual.volume + peso * s.reps) * 100) / 100;
      if (peso > atual.topWeight) {
        atual.topWeight = peso;
        atual.topReps = s.reps;
      }
      porSessao.set(s.sessionId, atual);
    }

    const historico = [...porSessao.values()].sort((a, b) => b.date.getTime() - a.date.getTime());

    return {
      ...exercicio,
      image: foto?.image ?? exercicio.image,
      hasUserPhoto: !!foto,
      custom: exercicio.userId !== null,
      favorite: !!favorito,
      timesPerformed: series.length,
      history: historico,
      /** Carga máxima × tempo, do mais antigo pro mais novo — é assim que o gráfico lê. */
      loadEvolution: [...historico].reverse().map((h) => ({
        date: h.date.toISOString().slice(0, 10),
        weight: h.topWeight,
        reps: h.topReps,
        oneRm: estimateOneRm(h.topWeight, h.topReps, formula),
        volume: h.volume,
      })),
    };
  }

  async create(userId: string, dto: CreateGymExerciseDto) {
    return this.prisma.gymExercise.create({
      data: {
        userId,
        // Sem slug: slug é identidade do catálogo global, e dois usuários podem criar "Supino do
        // João" sem colidir num índice único.
        slug: null,
        name: dto.name,
        primaryMuscle: dto.primaryMuscle,
        secondaryMuscles: dto.secondaryMuscles ?? [],
        equipment: dto.equipment,
        description: dto.description,
        instructions: dto.instructions ?? [],
        tips: dto.tips ?? [],
        commonMistakes: dto.commonMistakes ?? [],
        image: this.validatePhoto(dto.image),
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateGymExerciseDto) {
    await this.getOwned(userId, id);
    const { image, ...resto } = dto;
    return this.prisma.gymExercise.update({
      where: { id },
      data: { ...resto, ...(image !== undefined ? { image: this.validatePhoto(image) } : {}) },
    });
  }

  /**
   * Arquiva em vez de apagar: o exercício pode estar em fichas e no histórico de séries, e apagar
   * levaria o passado junto. Some da biblioteca, continua no que já aconteceu.
   */
  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);
    await this.prisma.gymExercise.update({ where: { id }, data: { archivedAt: new Date() } });
    return { id };
  }

  /**
   * Grava a foto que a pessoa tirou de um exercício.
   *
   * Vale pro exercício do CATÁLOGO também, e é justamente o ponto: o catálogo é global, então a
   * foto não pode morar nele — mora numa linha do usuário. `getVisible` (e não `getOwned`) porque
   * pôr foto num exercício do catálogo é legítimo; o que não é legítimo é alterar o catálogo.
   */
  async setPhoto(userId: string, id: string, image: string) {
    await this.getVisible(userId, id);
    const result = parseAssetPhoto(image);
    if (!result.ok) throw new BadRequestException(result.reason);

    return this.prisma.gymExercisePhoto.upsert({
      where: { userId_exerciseId: { userId, exerciseId: id } },
      create: { userId, exerciseId: id, image },
      update: { image },
    });
  }

  /** Tira a foto do usuário. O exercício volta a mostrar a do catálogo, se houver. */
  async removePhoto(userId: string, id: string) {
    await this.prisma.gymExercisePhoto.deleteMany({ where: { userId, exerciseId: id } });
    return { exerciseId: id };
  }

  async toggleFavorite(userId: string, id: string) {
    await this.getVisible(userId, id);
    const existente = await this.prisma.gymExerciseFavorite.findFirst({ where: { userId, exerciseId: id } });
    if (existente) {
      await this.prisma.gymExerciseFavorite.delete({ where: { id: existente.id } });
      return { exerciseId: id, favorite: false };
    }
    await this.prisma.gymExerciseFavorite.create({ data: { userId, exerciseId: id } });
    return { exerciseId: id, favorite: true };
  }

  /** Visível = do catálogo global ou da própria pessoa. */
  private async getVisible(userId: string, id: string) {
    const exercicio = await this.prisma.gymExercise.findFirst({
      where: { id, OR: [{ userId: null }, { userId }] },
    });
    if (!exercicio) throw new NotFoundException("Exercício não encontrado.");
    return exercicio;
  }

  /** Editável = só o próprio. O catálogo global não é de ninguém em particular. */
  private async getOwned(userId: string, id: string) {
    const exercicio = await this.getVisible(userId, id);
    if (exercicio.userId !== userId) {
      throw new ForbiddenException("Exercício do catálogo não pode ser alterado. Crie um próprio a partir dele.");
    }
    return exercicio;
  }

  private validatePhoto(image?: string | null): string | null | undefined {
    if (image === undefined) return undefined;
    if (image === null || image === "") return null;
    const result = parseAssetPhoto(image);
    if (!result.ok) throw new BadRequestException(result.reason);
    return image;
  }
}
