-- CreateEnum
CREATE TYPE "GymObjective" AS ENUM ('HIPERTROFIA', 'FORCA', 'EMAGRECIMENTO', 'CONDICIONAMENTO', 'MANUTENCAO');

-- CreateEnum
CREATE TYPE "GymLevel" AS ENUM ('INICIANTE', 'INTERMEDIARIO', 'AVANCADO');

-- CreateEnum
CREATE TYPE "GymMuscle" AS ENUM ('PEITO', 'COSTAS', 'BICEPS', 'TRICEPS', 'OMBROS', 'QUADRICEPS', 'POSTERIORES', 'GLUTEOS', 'PANTURRILHAS', 'ABDOMEN', 'TRAPEZIO', 'ANTEBRACO');

-- CreateEnum
CREATE TYPE "GymEquipment" AS ENUM ('BARRA', 'HALTER', 'MAQUINA', 'CABO', 'PESO_CORPORAL', 'SMITH', 'KETTLEBELL', 'ELASTICO', 'OUTRO');

-- CreateEnum
CREATE TYPE "GymWeightUnit" AS ENUM ('KG', 'LB');

-- CreateEnum
CREATE TYPE "GymOneRmFormula" AS ENUM ('EPLEY', 'BRZYCKI', 'LOMBARDI');

-- CreateEnum
CREATE TYPE "GymPhotoPose" AS ENUM ('FRENTE', 'COSTAS', 'LATERAL');

-- CreateEnum
CREATE TYPE "GymRecordKind" AS ENUM ('PESO_MAXIMO', 'REPS_NO_PESO', 'VOLUME_EXERCICIO', 'UM_RM');

-- CreateEnum
CREATE TYPE "GymTargetKind" AS ENUM ('CARGA', 'FREQUENCIA_SEMANAL', 'PESO_CORPORAL');

-- CreateTable
CREATE TABLE "gym_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "objective" "GymObjective" NOT NULL DEFAULT 'HIPERTROFIA',
    "level" "GymLevel" NOT NULL DEFAULT 'INICIANTE',
    "heightCm" INTEGER,
    "birthDate" TIMESTAMP(3),
    "weeklyTarget" INTEGER NOT NULL DEFAULT 4,
    "sessionMinutes" INTEGER NOT NULL DEFAULT 60,
    "defaultRestSeconds" INTEGER NOT NULL DEFAULT 90,
    "weightUnit" "GymWeightUnit" NOT NULL DEFAULT 'KG',
    "oneRmFormula" "GymOneRmFormula" NOT NULL DEFAULT 'EPLEY',
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "vibrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_exercises" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "slug" TEXT,
    "name" TEXT NOT NULL,
    "primaryMuscle" "GymMuscle" NOT NULL,
    "secondaryMuscles" "GymMuscle"[],
    "equipment" "GymEquipment" NOT NULL,
    "description" TEXT,
    "instructions" TEXT[],
    "tips" TEXT[],
    "commonMistakes" TEXT[],
    "image" TEXT,
    "videoUrl" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_exercise_favorites" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_exercise_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_workouts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "restBetweenExercisesSeconds" INTEGER,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_workout_exercises" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "sets" INTEGER NOT NULL DEFAULT 3,
    "targetRepsMin" INTEGER NOT NULL DEFAULT 8,
    "targetRepsMax" INTEGER NOT NULL DEFAULT 12,
    "targetWeight" DECIMAL(8,2),
    "restSeconds" INTEGER NOT NULL DEFAULT 90,
    "notes" TEXT,

    CONSTRAINT "gym_workout_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workoutId" TEXT,
    "name" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "totalVolume" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_sets" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "exerciseOrder" INTEGER NOT NULL DEFAULT 0,
    "setNumber" INTEGER NOT NULL,
    "weight" DECIMAL(8,2) NOT NULL,
    "reps" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "restSeconds" INTEGER,
    "restStartedAt" TIMESTAMP(3),
    "restEndedAt" TIMESTAMP(3),
    "restActualSeconds" INTEGER,
    "restWasPaused" BOOLEAN NOT NULL DEFAULT false,
    "restWasSkipped" BOOLEAN NOT NULL DEFAULT false,
    "restAdjustmentSeconds" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_measurements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weightKg" DECIMAL(6,2),
    "chest" DECIMAL(6,2),
    "waist" DECIMAL(6,2),
    "abdomen" DECIMAL(6,2),
    "hip" DECIMAL(6,2),
    "armRight" DECIMAL(6,2),
    "armLeft" DECIMAL(6,2),
    "thighRight" DECIMAL(6,2),
    "thighLeft" DECIMAL(6,2),
    "calfRight" DECIMAL(6,2),
    "calfLeft" DECIMAL(6,2),
    "custom" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_photos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "pose" "GymPhotoPose" NOT NULL,
    "image" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_personal_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "sessionId" TEXT,
    "kind" "GymRecordKind" NOT NULL,
    "weight" DECIMAL(8,2) NOT NULL,
    "reps" INTEGER NOT NULL,
    "estimatedOneRm" DECIMAL(8,2),
    "improvement" DECIMAL(8,2),
    "achievedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_personal_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_targets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "GymTargetKind" NOT NULL,
    "exerciseId" TEXT,
    "label" TEXT NOT NULL,
    "targetValue" DECIMAL(10,2) NOT NULL,
    "startValue" DECIMAL(10,2),
    "deadline" TIMESTAMP(3),
    "achievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gym_profiles_userId_key" ON "gym_profiles"("userId");

-- CreateIndex
CREATE INDEX "gym_exercises_userId_archivedAt_idx" ON "gym_exercises"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "gym_exercises_primaryMuscle_idx" ON "gym_exercises"("primaryMuscle");

-- CreateIndex
CREATE UNIQUE INDEX "gym_exercises_slug_key" ON "gym_exercises"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "gym_exercise_favorites_userId_exerciseId_key" ON "gym_exercise_favorites"("userId", "exerciseId");

-- CreateIndex
CREATE INDEX "gym_workouts_userId_archivedAt_order_idx" ON "gym_workouts"("userId", "archivedAt", "order");

-- CreateIndex
CREATE INDEX "gym_workout_exercises_exerciseId_idx" ON "gym_workout_exercises"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "gym_workout_exercises_workoutId_order_key" ON "gym_workout_exercises"("workoutId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "gym_sessions_clientId_key" ON "gym_sessions"("clientId");

-- CreateIndex
CREATE INDEX "gym_sessions_userId_startedAt_idx" ON "gym_sessions"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "gym_sets_exerciseId_completedAt_idx" ON "gym_sets"("exerciseId", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "gym_sets_sessionId_exerciseId_setNumber_key" ON "gym_sets"("sessionId", "exerciseId", "setNumber");

-- CreateIndex
CREATE INDEX "gym_measurements_userId_date_idx" ON "gym_measurements"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "gym_measurements_userId_date_key" ON "gym_measurements"("userId", "date");

-- CreateIndex
CREATE INDEX "gym_photos_userId_pose_date_idx" ON "gym_photos"("userId", "pose", "date");

-- CreateIndex
CREATE INDEX "gym_personal_records_userId_achievedAt_idx" ON "gym_personal_records"("userId", "achievedAt");

-- CreateIndex
CREATE INDEX "gym_personal_records_userId_exerciseId_kind_achievedAt_idx" ON "gym_personal_records"("userId", "exerciseId", "kind", "achievedAt");

-- CreateIndex
CREATE INDEX "gym_targets_userId_achievedAt_idx" ON "gym_targets"("userId", "achievedAt");

-- AddForeignKey
ALTER TABLE "gym_profiles" ADD CONSTRAINT "gym_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_exercises" ADD CONSTRAINT "gym_exercises_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_exercise_favorites" ADD CONSTRAINT "gym_exercise_favorites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_exercise_favorites" ADD CONSTRAINT "gym_exercise_favorites_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "gym_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_workouts" ADD CONSTRAINT "gym_workouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_workout_exercises" ADD CONSTRAINT "gym_workout_exercises_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "gym_workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_workout_exercises" ADD CONSTRAINT "gym_workout_exercises_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "gym_exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_sessions" ADD CONSTRAINT "gym_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_sessions" ADD CONSTRAINT "gym_sessions_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "gym_workouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_sets" ADD CONSTRAINT "gym_sets_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "gym_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_sets" ADD CONSTRAINT "gym_sets_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "gym_exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_measurements" ADD CONSTRAINT "gym_measurements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_photos" ADD CONSTRAINT "gym_photos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_personal_records" ADD CONSTRAINT "gym_personal_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_personal_records" ADD CONSTRAINT "gym_personal_records_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "gym_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_personal_records" ADD CONSTRAINT "gym_personal_records_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "gym_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_targets" ADD CONSTRAINT "gym_targets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_targets" ADD CONSTRAINT "gym_targets_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "gym_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;
