-- AlterTable
ALTER TABLE "market_products" ADD COLUMN     "gtin" TEXT;

-- AlterTable
ALTER TABLE "market_purchase_items" ADD COLUMN     "gtin" TEXT;

-- CreateIndex
CREATE INDEX "market_products_userId_gtin_idx" ON "market_products"("userId", "gtin");
