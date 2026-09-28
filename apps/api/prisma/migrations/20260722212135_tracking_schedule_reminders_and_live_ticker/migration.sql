-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'TRACKING_START_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE 'TRACKING_END_REMINDER';

-- AlterTable
ALTER TABLE "tracking_jobs" ADD COLUMN     "expectedEndTime" TEXT,
ADD COLUMN     "expectedStartTime" TEXT;

-- AlterTable
ALTER TABLE "tracking_sessions" ADD COLUMN     "endReminderSentAt" TIMESTAMP(3);
