-- AlterTable
ALTER TABLE "household_bills" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "household_cards" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;
