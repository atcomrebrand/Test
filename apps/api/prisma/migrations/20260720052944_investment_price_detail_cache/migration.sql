-- AlterTable
ALTER TABLE "investment_price_cache" ADD COLUMN     "changePercent" DECIMAL(10,4),
ADD COLUMN     "fundamentals" JSONB,
ADD COLUMN     "history" JSONB;
