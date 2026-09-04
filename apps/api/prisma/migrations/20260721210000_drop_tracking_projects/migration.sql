-- DropForeignKey
ALTER TABLE "tracking_projects" DROP CONSTRAINT "tracking_projects_userId_fkey";

-- DropTable
DROP TABLE "tracking_projects";

-- DropEnum
DROP TYPE "TrackingProjectStatus";

