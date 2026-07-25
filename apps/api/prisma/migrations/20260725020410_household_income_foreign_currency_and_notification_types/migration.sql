-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'HOUSEHOLD_BILL_DUE';
ALTER TYPE "NotificationType" ADD VALUE 'HOUSEHOLD_MONTH_FULLY_PAID';

-- AlterTable
ALTER TABLE "household_incomes" ADD COLUMN     "exchangeRate" DECIMAL(12,6),
ADD COLUMN     "grossAmountForeign" DECIMAL(12,2),
ADD COLUMN     "isForeignCurrency" BOOLEAN NOT NULL DEFAULT false;
