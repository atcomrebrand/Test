-- CreateEnum
CREATE TYPE "TrackingSessionStatus" AS ENUM ('RUNNING', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TrackingProjectStatus" AS ENUM ('EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TrackingIncomeCategory" AS ENUM ('DIVIDENDO', 'VENDA', 'BONIFICACAO', 'CASHBACK', 'REEMBOLSO', 'PRESENTE', 'OUTRO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TRACKING_FORGOT_CHECKOUT';
ALTER TYPE "NotificationType" ADD VALUE 'TRACKING_LONG_SESSION';

-- CreateTable
CREATE TABLE "tracking_jobs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "client" TEXT,
    "monthlyValue" DECIMAL(12,2) NOT NULL,
    "expectedHoursPerDay" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "color" TEXT NOT NULL DEFAULT '#7C3AED',
    "weekdays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracking_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3),
    "status" "TrackingSessionStatus" NOT NULL DEFAULT 'RUNNING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracking_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_session_pauses" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "pausedAt" TIMESTAMP(3) NOT NULL,
    "resumedAt" TIMESTAMP(3),

    CONSTRAINT "tracking_session_pauses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client" TEXT,
    "amountReceived" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hoursSpent" DECIMAL(8,2) NOT NULL,
    "status" "TrackingProjectStatus" NOT NULL DEFAULT 'CONCLUIDO',
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracking_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_incomes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "TrackingIncomeCategory" NOT NULL DEFAULT 'OUTRO',
    "amount" DECIMAL(12,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tracking_jobs_userId_active_idx" ON "tracking_jobs"("userId", "active");

-- CreateIndex
CREATE INDEX "tracking_jobs_userId_deletedAt_idx" ON "tracking_jobs"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "tracking_sessions_userId_status_idx" ON "tracking_sessions"("userId", "status");

-- CreateIndex
CREATE INDEX "tracking_sessions_userId_checkIn_idx" ON "tracking_sessions"("userId", "checkIn");

-- CreateIndex
CREATE INDEX "tracking_sessions_jobId_idx" ON "tracking_sessions"("jobId");

-- CreateIndex
CREATE INDEX "tracking_session_pauses_sessionId_idx" ON "tracking_session_pauses"("sessionId");

-- CreateIndex
CREATE INDEX "tracking_projects_userId_date_idx" ON "tracking_projects"("userId", "date");

-- CreateIndex
CREATE INDEX "tracking_projects_userId_deletedAt_idx" ON "tracking_projects"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "tracking_incomes_userId_date_idx" ON "tracking_incomes"("userId", "date");

-- CreateIndex
CREATE INDEX "tracking_incomes_userId_deletedAt_idx" ON "tracking_incomes"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "tracking_audit_logs_userId_entity_entityId_idx" ON "tracking_audit_logs"("userId", "entity", "entityId");

-- AddForeignKey
ALTER TABLE "tracking_jobs" ADD CONSTRAINT "tracking_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_sessions" ADD CONSTRAINT "tracking_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_sessions" ADD CONSTRAINT "tracking_sessions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "tracking_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_session_pauses" ADD CONSTRAINT "tracking_session_pauses_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "tracking_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_projects" ADD CONSTRAINT "tracking_projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_incomes" ADD CONSTRAINT "tracking_incomes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_audit_logs" ADD CONSTRAINT "tracking_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
