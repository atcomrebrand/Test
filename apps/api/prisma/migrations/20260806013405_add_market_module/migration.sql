-- CreateTable
CREATE TABLE "market_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "storeCnpj" TEXT,
    "accessKey" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_products" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedKey" TEXT NOT NULL,
    "unit" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_purchase_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "storeCode" TEXT,
    "quantity" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "market_purchases_userId_purchaseDate_idx" ON "market_purchases"("userId", "purchaseDate");

-- CreateIndex
CREATE UNIQUE INDEX "market_purchases_userId_accessKey_key" ON "market_purchases"("userId", "accessKey");

-- CreateIndex
CREATE UNIQUE INDEX "market_products_userId_normalizedKey_key" ON "market_products"("userId", "normalizedKey");

-- CreateIndex
CREATE INDEX "market_purchase_items_userId_productId_idx" ON "market_purchase_items"("userId", "productId");

-- CreateIndex
CREATE INDEX "market_purchase_items_purchaseId_idx" ON "market_purchase_items"("purchaseId");

-- AddForeignKey
ALTER TABLE "market_purchases" ADD CONSTRAINT "market_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_products" ADD CONSTRAINT "market_products_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_purchase_items" ADD CONSTRAINT "market_purchase_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_purchase_items" ADD CONSTRAINT "market_purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "market_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_purchase_items" ADD CONSTRAINT "market_purchase_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "market_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
