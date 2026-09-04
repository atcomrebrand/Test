-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "homeModules" TEXT[] DEFAULT ARRAY[]::TEXT[];
