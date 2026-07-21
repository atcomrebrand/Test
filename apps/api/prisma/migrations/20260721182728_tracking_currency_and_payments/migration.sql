-- CreateEnum
CREATE TYPE "TrackingCurrency" AS ENUM ('BRL', 'USD');

-- AlterTable
ALTER TABLE "tracking_jobs" ADD COLUMN     "currency" "TrackingCurrency" NOT NULL DEFAULT 'BRL';

-- CreateTable
CREATE TABLE "tracking_job_payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "referenceYear" INTEGER NOT NULL,
    "referenceMonth" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "TrackingCurrency" NOT NULL,
    "exchangeRate" DECIMAL(12,6),
    "amountBRL" DECIMAL(12,2) NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracking_job_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_fx_rate_cache" (
    "id" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "rate" DECIMAL(12,6) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_fx_rate_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tracking_job_payments_userId_idx" ON "tracking_job_payments"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_job_payments_jobId_referenceYear_referenceMonth_key" ON "tracking_job_payments"("jobId", "referenceYear", "referenceMonth");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_fx_rate_cache_pair_key" ON "tracking_fx_rate_cache"("pair");

-- AddForeignKey
ALTER TABLE "tracking_job_payments" ADD CONSTRAINT "tracking_job_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_job_payments" ADD CONSTRAINT "tracking_job_payments_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "tracking_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
