-- Módulo Lucro Certo: precificação, lucro por venda e ponto de equilíbrio.
-- Tudo aditivo: tipos e tabelas novas, nada tocado no que já existe.

CREATE TYPE "ProfitChannelType" AS ENUM ('MARKETPLACE', 'DIRECT', 'OWN_STORE', 'WHOLESALE');
CREATE TYPE "ProfitTaxMode" AS ENUM ('PERCENT', 'FIXED');

CREATE TABLE "profit_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taxEnabled" BOOLEAN NOT NULL DEFAULT false,
    "taxMode" "ProfitTaxMode" NOT NULL DEFAULT 'PERCENT',
    "taxPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxMonthly" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "defaultMarginPercent" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "profit_settings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "profit_settings_userId_key" ON "profit_settings"("userId");

CREATE TABLE "profit_fixed_costs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "profit_fixed_costs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "profit_fixed_costs_userId_active_idx" ON "profit_fixed_costs"("userId", "active");

CREATE TABLE "profit_channels" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProfitChannelType" NOT NULL DEFAULT 'MARKETPLACE',
    "feePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "feeFixed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shippingCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "returnRatePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "profit_channels_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "profit_channels_userId_deletedAt_idx" ON "profit_channels"("userId", "deletedAt");

CREATE TABLE "profit_products" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "cost" DECIMAL(12,2) NOT NULL,
    "packagingCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "extraCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "profit_products_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "profit_products_userId_deletedAt_idx" ON "profit_products"("userId", "deletedAt");

CREATE TABLE "profit_product_channels" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "price" DECIMAL(12,2),
    "targetMarginPercent" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "profit_product_channels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "profit_product_channels_productId_channelId_key" ON "profit_product_channels"("productId", "channelId");
CREATE INDEX "profit_product_channels_channelId_idx" ON "profit_product_channels"("channelId");

ALTER TABLE "profit_settings" ADD CONSTRAINT "profit_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profit_fixed_costs" ADD CONSTRAINT "profit_fixed_costs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profit_channels" ADD CONSTRAINT "profit_channels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profit_products" ADD CONSTRAINT "profit_products_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profit_product_channels" ADD CONSTRAINT "profit_product_channels_productId_fkey" FOREIGN KEY ("productId") REFERENCES "profit_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profit_product_channels" ADD CONSTRAINT "profit_product_channels_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "profit_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
