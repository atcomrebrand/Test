import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import {
  GymEquipment,
  GymLevel,
  GymMuscle,
  GymObjective,
  GymOneRmFormula,
  GymPhotoPose,
  GymTargetKind,
  GymWeightUnit,
} from "@prisma/client";

export class UpdateGymProfileDto {
  @IsOptional() @IsEnum(GymObjective) objective?: GymObjective;
  @IsOptional() @IsEnum(GymLevel) level?: GymLevel;
  @IsOptional() @IsInt() @Min(100) @Max(260) heightCm?: number;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsInt() @Min(1) @Max(14) weeklyTarget?: number;
  @IsOptional() @IsInt() @Min(10) @Max(300) sessionMinutes?: number;
  @IsOptional() @IsInt() @Min(0) @Max(600) defaultRestSeconds?: number;
  @IsOptional() @IsEnum(GymWeightUnit) weightUnit?: GymWeightUnit;
  @IsOptional() @IsEnum(GymOneRmFormula) oneRmFormula?: GymOneRmFormula;
  @IsOptional() @IsBoolean() soundEnabled?: boolean;
  @IsOptional() @IsBoolean() vibrationEnabled?: boolean;
  /** Marca o onboarding como concluído. Só vai `true` na última etapa. */
  @IsOptional() @IsBoolean() onboarded?: boolean;
}

export class CreateGymExerciseDto {
  @IsString() @MaxLength(120) name!: string;
  @IsEnum(GymMuscle) primaryMuscle!: GymMuscle;
  @IsOptional() @IsArray() @IsEnum(GymMuscle, { each: true }) @ArrayMaxSize(6) secondaryMuscles?: GymMuscle[];
  @IsEnum(GymEquipment) equipment!: GymEquipment;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(20) instructions?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(20) tips?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayMaxSize(20) commonMistakes?: string[];
  @IsOptional() @IsString() image?: string;
}

export class UpdateGymExerciseDto extends CreateGymExerciseDto {
  @IsOptional() @IsString() @MaxLength(120) declare name: string;
  @IsOptional() @IsEnum(GymMuscle) declare primaryMuscle: GymMuscle;
  @IsOptional() @IsEnum(GymEquipment) declare equipment: GymEquipment;
}

export class SetExercisePhotoDto {
  @IsString() image!: string;
}

export class WorkoutExerciseDto {
  @IsString() exerciseId!: string;
  @IsOptional() @IsInt() @Min(1) @Max(20) sets?: number;
  @IsOptional() @IsInt() @Min(1) @Max(200) targetRepsMin?: number;
  @IsOptional() @IsInt() @Min(1) @Max(200) targetRepsMax?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1000) targetWeight?: number;
  @IsOptional() @IsInt() @Min(0) @Max(900) restSeconds?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreateGymWorkoutDto {
  @IsString() @MaxLength(80) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsInt() @Min(0) @Max(900) restBetweenExercisesSeconds?: number;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => WorkoutExerciseDto) exercises?: WorkoutExerciseDto[];
}

export class UpdateGymWorkoutDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsInt() @Min(0) @Max(900) restBetweenExercisesSeconds?: number;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  /** Quando vem, SUBSTITUI a lista inteira — é como a tela de montagem salva. */
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => WorkoutExerciseDto) exercises?: WorkoutExerciseDto[];
}

export class ReorderDto {
  @IsArray() @IsString({ each: true }) ids!: string[];
}

export class SyncSetDto {
  @IsString() exerciseId!: string;
  @IsInt() @Min(1) setNumber!: number;
  @IsOptional() @IsInt() @Min(0) exerciseOrder?: number;
  @IsNumber() @Min(0) @Max(2000) weight!: number;
  @IsInt() @Min(0) @Max(500) reps!: number;
  @IsOptional() @IsBoolean() completed?: boolean;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;

  @IsOptional() @IsInt() @Min(0) @Max(3600) restSeconds?: number;
  @IsOptional() @IsDateString() restStartedAt?: string;
  @IsOptional() @IsDateString() restEndedAt?: string;
  @IsOptional() @IsInt() @Min(0) @Max(86400) restActualSeconds?: number;
  @IsOptional() @IsBoolean() restWasPaused?: boolean;
  @IsOptional() @IsBoolean() restWasSkipped?: boolean;
  @IsOptional() @IsInt() @Min(-3600) @Max(3600) restAdjustmentSeconds?: number;
  @IsOptional() @IsDateString() completedAt?: string;
}

/**
 * Sobe uma sessão inteira de uma vez.
 *
 * O `clientId` nasce no aparelho e é o que torna a subida idempotente: a mesma sessão reenviada
 * (porque a rede caiu no meio, porque o app reabriu) atualiza a que já existe em vez de criar outra.
 * Sem isso, o offline do §38 duplicaria treino a cada tentativa.
 */
export class SyncGymSessionDto {
  @IsString() @MaxLength(64) clientId!: string;
  @IsOptional() @IsString() workoutId?: string;
  @IsString() @MaxLength(120) name!: string;
  @IsDateString() startedAt!: string;
  @IsOptional() @IsDateString() finishedAt?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SyncSetDto) sets!: SyncSetDto[];
}

export class UpsertGymMeasurementDto {
  @IsDateString() date!: string;
  @IsOptional() @IsNumber() @Min(0) @Max(400) weightKg?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(300) chest?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(300) waist?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(300) abdomen?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(300) hip?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(150) armRight?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(150) armLeft?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(200) thighRight?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(200) thighLeft?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(150) calfRight?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(150) calfLeft?: number;
  @IsOptional() custom?: Record<string, number>;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class CreateGymPhotoDto {
  @IsDateString() date!: string;
  @IsEnum(GymPhotoPose) pose!: GymPhotoPose;
  @IsString() image!: string;
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
}

export class CreateGymTargetDto {
  @IsEnum(GymTargetKind) kind!: GymTargetKind;
  @IsOptional() @IsString() exerciseId?: string;
  @IsString() @MaxLength(120) label!: string;
  @IsNumber() @Min(0) targetValue!: number;
  @IsOptional() @IsNumber() @Min(0) startValue?: number;
  @IsOptional() @IsDateString() deadline?: string;
}

export class UpdateGymTargetDto {
  @IsOptional() @IsString() @MaxLength(120) label?: string;
  @IsOptional() @IsNumber() @Min(0) targetValue?: number;
  @IsOptional() @IsNumber() @Min(0) startValue?: number;
  @IsOptional() @IsDateString() deadline?: string;
  @IsOptional() @IsBoolean() achieved?: boolean;
}
