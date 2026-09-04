-- AlterTable
ALTER TABLE "market_products" ADD COLUMN     "canonicalId" TEXT;

-- CreateIndex
CREATE INDEX "market_products_userId_canonicalId_idx" ON "market_products"("userId", "canonicalId");

-- AddForeignKey
ALTER TABLE "market_products" ADD CONSTRAINT "market_products_canonicalId_fkey" FOREIGN KEY ("canonicalId") REFERENCES "market_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
