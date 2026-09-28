-- AlterTable
ALTER TABLE "household_cards" ADD COLUMN     "linkedCardId" TEXT;

-- CreateIndex
CREATE INDEX "household_cards_linkedCardId_idx" ON "household_cards"("linkedCardId");

-- AddForeignKey
ALTER TABLE "household_cards" ADD CONSTRAINT "household_cards_linkedCardId_fkey" FOREIGN KEY ("linkedCardId") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
