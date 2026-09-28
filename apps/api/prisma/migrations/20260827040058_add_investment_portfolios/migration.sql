-- AlterTable
ALTER TABLE "investment_fixed_incomes" ADD COLUMN     "portfolioId" TEXT;

-- CreateTable
CREATE TABLE "investment_portfolios" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investment_portfolios_userId_deletedAt_idx" ON "investment_portfolios"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "investment_fixed_incomes_userId_portfolioId_idx" ON "investment_fixed_incomes"("userId", "portfolioId");

-- AddForeignKey
ALTER TABLE "investment_portfolios" ADD CONSTRAINT "investment_portfolios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_fixed_incomes" ADD CONSTRAINT "investment_fixed_incomes_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "investment_portfolios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
