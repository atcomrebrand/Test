import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { GymEquipment, GymMuscle } from "@prisma/client";
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard";
import { AuthUser, CurrentUser } from "../../../common/decorators/current-user.decorator";
import { GymExercisesService } from "../application/gym-exercises.service";
import { GymProfileService } from "../application/gym-profile.service";
import { GymMuscleMapService } from "../application/gym-muscle-map.service";
import { GymProgressService, ProgressRange } from "../application/gym-progress.service";
import { GymSessionsService } from "../application/gym-sessions.service";
import { GymWorkoutsService } from "../application/gym-workouts.service";
import {
  CreateGymExerciseDto,
  CreateGymPhotoDto,
  CreateGymTargetDto,
  CreateGymWorkoutDto,
  ReorderDto,
  SetExercisePhotoDto,
  SyncGymSessionDto,
  UpdateGymExerciseDto,
  UpdateGymProfileDto,
  UpdateGymTargetDto,
  UpdateGymWorkoutDto,
  UpsertGymMeasurementDto,
} from "../application/dto/gym.dto";

const RANGES: ProgressRange[] = ["WEEK", "MONTH", "M3", "M6", "YEAR"];

function parseRange(value: string | undefined, fallback: ProgressRange): ProgressRange {
  const alvo = (value ?? "").toUpperCase() as ProgressRange;
  return RANGES.includes(alvo) ? alvo : fallback;
}

/**
 * Todas as rotas da Academia.
 *
 * Um controller só porque o módulo, apesar de grande, tem um caminho de leitura único — e cada
 * método já delega pro service certo. Toda rota é escopada por `user.userId`: nenhum serviço aqui
 * aceita um id sem conferir de quem ele é.
 */
@UseGuards(JwtAuthGuard)
@Controller("gym")
export class GymController {
  constructor(
    private readonly profiles: GymProfileService,
    private readonly exercises: GymExercisesService,
    private readonly workouts: GymWorkoutsService,
    private readonly sessions: GymSessionsService,
    private readonly progress: GymProgressService,
    private readonly muscleMap: GymMuscleMapService,
  ) {}

  // --- Início e perfil ---

  @Get("home")
  home(@CurrentUser() user: AuthUser, @Query("range") range?: string) {
    return this.progress.home(user.userId, parseRange(range, "MONTH"));
  }

  @Get("profile")
  profile(@CurrentUser() user: AuthUser) {
    return this.profiles.ensure(user.userId);
  }

  @Put("profile")
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateGymProfileDto) {
    return this.profiles.update(user.userId, dto);
  }

  // --- Exercícios ---

  @Get("exercises")
  listExercises(
    @CurrentUser() user: AuthUser,
    @Query("query") query?: string,
    @Query("muscle") muscle?: string,
    @Query("equipment") equipment?: string,
    @Query("favorites") favorites?: string,
  ) {
    return this.exercises.list(user.userId, {
      query,
      muscle: muscle ? (muscle as GymMuscle) : undefined,
      equipment: equipment ? (equipment as GymEquipment) : undefined,
      onlyFavorites: favorites === "true",
    });
  }

  @Get("exercises/:id")
  async getExercise(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    const perfil = await this.profiles.ensure(user.userId);
    return this.exercises.findOne(user.userId, id, perfil.oneRmFormula);
  }

  @Post("exercises")
  createExercise(@CurrentUser() user: AuthUser, @Body() dto: CreateGymExerciseDto) {
    return this.exercises.create(user.userId, dto);
  }

  @Patch("exercises/:id")
  updateExercise(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateGymExerciseDto) {
    return this.exercises.update(user.userId, id, dto);
  }

  @Delete("exercises/:id")
  removeExercise(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.exercises.remove(user.userId, id);
  }

  /** Foto do exercício. Vale pro catálogo também — ela é sua, não dele. */
  @Put("exercises/:id/photo")
  setExercisePhoto(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: SetExercisePhotoDto) {
    return this.exercises.setPhoto(user.userId, id, dto.image);
  }

  @Delete("exercises/:id/photo")
  removeExercisePhoto(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.exercises.removePhoto(user.userId, id);
  }

  @Post("exercises/:id/favorite")
  favorite(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.exercises.toggleFavorite(user.userId, id);
  }

  // --- Treinos ---

  @Get("workouts")
  listWorkouts(@CurrentUser() user: AuthUser) {
    return this.workouts.list(user.userId);
  }

  // Antes de `:id` de propósito: "reorder" cairia na rota de detalhe.
  @Patch("workouts/reorder")
  reorderWorkouts(@CurrentUser() user: AuthUser, @Body() dto: ReorderDto) {
    return this.workouts.reorder(user.userId, dto.ids);
  }

  @Get("workouts/:id")
  getWorkout(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.workouts.findOne(user.userId, id);
  }

  /** Tudo que o modo treino precisa pra rodar offline daqui em diante. */
  @Get("workouts/:id/prefill")
  prefill(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.workouts.prefill(user.userId, id);
  }

  @Post("workouts")
  createWorkout(@CurrentUser() user: AuthUser, @Body() dto: CreateGymWorkoutDto) {
    return this.workouts.create(user.userId, dto);
  }

  @Patch("workouts/:id")
  updateWorkout(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateGymWorkoutDto) {
    return this.workouts.update(user.userId, id, dto);
  }

  @Post("workouts/:id/duplicate")
  duplicateWorkout(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.workouts.duplicate(user.userId, id);
  }

  @Delete("workouts/:id")
  removeWorkout(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.workouts.remove(user.userId, id);
  }

  // --- Sessões ---

  @Post("sessions")
  syncSession(@CurrentUser() user: AuthUser, @Body() dto: SyncGymSessionDto) {
    return this.sessions.sync(user.userId, dto);
  }

  @Get("sessions")
  listSessions(@CurrentUser() user: AuthUser, @Query("from") from?: string, @Query("to") to?: string) {
    return this.sessions.list(user.userId, from, to);
  }

  @Get("sessions/:id")
  getSession(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.sessions.findOne(user.userId, id);
  }

  @Delete("sessions/:id")
  removeSession(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.sessions.remove(user.userId, id);
  }

  // --- Progresso ---

  /** Dias com treino de um mês. Sem parâmetro, o mês corrente. */
  @Get("calendar")
  calendar(@CurrentUser() user: AuthUser, @Query("year") year?: string, @Query("month") month?: string) {
    const agora = new Date();
    const ano = Number(year) || agora.getFullYear();
    const mes = Number(month) || agora.getMonth() + 1;
    return this.progress.calendar(user.userId, ano, Math.min(12, Math.max(1, mes)));
  }

  /** Janelas oferecidas na tela. Dia solto não entra: 3 dias não é uma unidade de treino, e a
   *  faixa de séries que pinta o boneco é semanal. */
  @Get("muscle-map")
  muscleMapEndpoint(@CurrentUser() user: AuthUser, @Query("days") days?: string) {
    const permitidos = [7, 14, 30, 90];
    const pedido = Number(days);
    return this.muscleMap.map(user.userId, permitidos.includes(pedido) ? pedido : 7);
  }

  @Get("progress")
  getProgress(@CurrentUser() user: AuthUser, @Query("range") range?: string) {
    return this.progress.progress(user.userId, parseRange(range, "M3"));
  }

  @Get("records")
  records(@CurrentUser() user: AuthUser) {
    return this.progress.listRecords(user.userId);
  }

  // --- Medidas ---

  @Get("measurements")
  measurements(@CurrentUser() user: AuthUser) {
    return this.progress.listMeasurements(user.userId);
  }

  @Post("measurements")
  upsertMeasurement(@CurrentUser() user: AuthUser, @Body() dto: UpsertGymMeasurementDto) {
    return this.progress.upsertMeasurement(user.userId, dto);
  }

  @Delete("measurements/:id")
  removeMeasurement(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.progress.removeMeasurement(user.userId, id);
  }

  // --- Fotos ---

  @Get("photos")
  photos(@CurrentUser() user: AuthUser) {
    return this.progress.listPhotos(user.userId);
  }

  @Post("photos")
  createPhoto(@CurrentUser() user: AuthUser, @Body() dto: CreateGymPhotoDto) {
    return this.progress.createPhoto(user.userId, dto);
  }

  @Delete("photos/:id")
  removePhoto(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.progress.removePhoto(user.userId, id);
  }

  // --- Metas ---

  @Get("targets")
  targets(@CurrentUser() user: AuthUser) {
    return this.progress.listTargets(user.userId);
  }

  @Post("targets")
  createTarget(@CurrentUser() user: AuthUser, @Body() dto: CreateGymTargetDto) {
    return this.progress.createTarget(user.userId, dto);
  }

  @Patch("targets/:id")
  updateTarget(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateGymTargetDto) {
    return this.progress.updateTarget(user.userId, id, dto);
  }

  @Delete("targets/:id")
  removeTarget(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.progress.removeTarget(user.userId, id);
  }
}
