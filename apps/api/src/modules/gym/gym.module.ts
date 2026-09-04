import { Module } from "@nestjs/common";
import { GymExercisesService } from "./application/gym-exercises.service";
import { GymProfileService } from "./application/gym-profile.service";
import { GymMuscleMapService } from "./application/gym-muscle-map.service";
import { GymProgressService } from "./application/gym-progress.service";
import { GymSessionsService } from "./application/gym-sessions.service";
import { GymWorkoutsService } from "./application/gym-workouts.service";
import { GymController } from "./interface/gym.controller";

/**
 * Academia: fichas, execução de treino, histórico, progresso, medidas, recordes e metas.
 *
 * Sem `imports`: não depende de nenhum outro módulo do app. O único acoplamento é uma função pura
 * de validação de imagem, importada por caminho do módulo de financiamentos — duplicar um validador
 * de segurança é pior do que a dependência.
 */
@Module({
  controllers: [GymController],
  providers: [GymProfileService, GymExercisesService, GymWorkoutsService, GymSessionsService, GymProgressService, GymMuscleMapService],
})
export class GymModule {}
