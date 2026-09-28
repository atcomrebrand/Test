-- AlterTable
ALTER TABLE "tracking_jobs" ADD COLUMN     "daysOff" TEXT[] DEFAULT ARRAY[]::TEXT[];
