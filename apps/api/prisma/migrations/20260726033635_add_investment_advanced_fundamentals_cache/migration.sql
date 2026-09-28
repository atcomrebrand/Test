-- AlterTable
ALTER TABLE "investment_price_cache" ADD COLUMN     "advancedFundamentals" JSONB,
ADD COLUMN     "advancedFundamentalsAt" TIMESTAMP(3);
