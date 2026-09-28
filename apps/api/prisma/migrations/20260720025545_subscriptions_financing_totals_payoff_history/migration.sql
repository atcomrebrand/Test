-- CreateEnum
CREATE TYPE "RecurringBillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "autoRenew" BOOLEAN DEFAULT true,
ADD COLUMN     "billingCycle" "RecurringBillingCycle";

-- AlterTable
ALTER TABLE "settings" ADD COLUMN     "includeFinancingInTotals" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "financing_payoff_quotes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financingId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "quotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financing_payoff_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financing_payoff_quotes_financingId_quotedAt_idx" ON "financing_payoff_quotes"("financingId", "quotedAt");

-- AddForeignKey
ALTER TABLE "financing_payoff_quotes" ADD CONSTRAINT "financing_payoff_quotes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financing_payoff_quotes" ADD CONSTRAINT "financing_payoff_quotes_financingId_fkey" FOREIGN KEY ("financingId") REFERENCES "financings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
