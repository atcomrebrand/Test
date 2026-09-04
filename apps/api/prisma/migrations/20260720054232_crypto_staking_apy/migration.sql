-- AlterEnum
ALTER TYPE "InvestmentIncomeType" ADD VALUE 'STAKING';

-- AlterTable
ALTER TABLE "investment_assets" ADD COLUMN     "stakingApyPercent" DECIMAL(7,4);
