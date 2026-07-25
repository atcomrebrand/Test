-- AlterEnum
ALTER TYPE "HouseholdBillStatus" ADD VALUE 'SKIPPED';

-- AlterTable
ALTER TABLE "household_bill_entries" ADD COLUMN     "skipped" BOOLEAN NOT NULL DEFAULT false;
