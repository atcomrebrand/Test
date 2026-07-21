-- CreateEnum
CREATE TYPE "TrackingJobType" AS ENUM ('FIXO', 'FREELANCE');

-- AlterTable
ALTER TABLE "tracking_jobs" ADD COLUMN     "totalAgreedValue" DECIMAL(12,2),
ADD COLUMN     "type" "TrackingJobType" NOT NULL DEFAULT 'FIXO',
ALTER COLUMN "monthlyValue" DROP NOT NULL;
