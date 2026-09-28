-- CreateEnum
CREATE TYPE "InvestmentAssetClass" AS ENUM ('STOCK', 'FII', 'CRYPTO', 'FUND');

-- CreateEnum
CREATE TYPE "InvestmentTransactionType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "InvestmentIncomeType" AS ENUM ('DIVIDENDO', 'JCP', 'RENDIMENTO', 'JUROS', 'OUTRO');

-- CreateEnum
CREATE TYPE "FixedIncomeType" AS ENUM ('CDB', 'LCI', 'LCA', 'TESOURO', 'OUTRO');

-- CreateEnum
CREATE TYPE "FixedIncomeLiquidity" AS ENUM ('DIARIA', 'NO_VENCIMENTO', 'OUTRO');

-- CreateEnum
CREATE TYPE "FixedIncomeIndexer" AS ENUM ('PREFIXADO', 'POS_FIXADO_CDI', 'IPCA_MAIS', 'OUTRO');

-- CreateTable
CREATE TABLE "investment_assets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "class" "InvestmentAssetClass" NOT NULL,
    "ticker" TEXT NOT NULL,
    "name" TEXT,
    "broker" TEXT,
    "wallet" TEXT,
    "network" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_transactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "InvestmentTransactionType" NOT NULL,
    "quantity" DECIMAL(20,8) NOT NULL,
    "unitPrice" DECIMAL(20,8) NOT NULL,
    "fees" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_incomes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT,
    "fixedIncomeId" TEXT,
    "type" "InvestmentIncomeType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_fixed_incomes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "type" "FixedIncomeType" NOT NULL,
    "principalAmount" DECIMAL(14,2) NOT NULL,
    "applicationDate" TIMESTAMP(3) NOT NULL,
    "maturityDate" TIMESTAMP(3) NOT NULL,
    "liquidity" "FixedIncomeLiquidity" NOT NULL,
    "indexer" "FixedIncomeIndexer" NOT NULL,
    "fixedRatePercent" DECIMAL(7,4),
    "cdiPercent" DECIMAL(7,4),
    "redeemedAt" TIMESTAMP(3),
    "redeemedNetAmount" DECIMAL(14,2),
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_fixed_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_contributions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "category" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_cash_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_cash_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_price_cache" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "assetClass" "InvestmentAssetClass" NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_price_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investment_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "autoUpdatePrices" BOOLEAN NOT NULL DEFAULT true,
    "assetDropAlertPercent" INTEGER,
    "cryptoDropAlertPercent" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "investment_assets_userId_class_idx" ON "investment_assets"("userId", "class");

-- CreateIndex
CREATE INDEX "investment_assets_userId_deletedAt_idx" ON "investment_assets"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "investment_transactions_assetId_transactionDate_idx" ON "investment_transactions"("assetId", "transactionDate");

-- CreateIndex
CREATE INDEX "investment_transactions_userId_transactionDate_idx" ON "investment_transactions"("userId", "transactionDate");

-- CreateIndex
CREATE INDEX "investment_incomes_userId_paymentDate_idx" ON "investment_incomes"("userId", "paymentDate");

-- CreateIndex
CREATE INDEX "investment_incomes_assetId_idx" ON "investment_incomes"("assetId");

-- CreateIndex
CREATE INDEX "investment_incomes_fixedIncomeId_idx" ON "investment_incomes"("fixedIncomeId");

-- CreateIndex
CREATE INDEX "investment_fixed_incomes_userId_deletedAt_idx" ON "investment_fixed_incomes"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "investment_fixed_incomes_userId_maturityDate_idx" ON "investment_fixed_incomes"("userId", "maturityDate");

-- CreateIndex
CREATE INDEX "investment_contributions_userId_date_idx" ON "investment_contributions"("userId", "date");

-- CreateIndex
CREATE INDEX "investment_cash_accounts_userId_deletedAt_idx" ON "investment_cash_accounts"("userId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "investment_price_cache_symbol_assetClass_key" ON "investment_price_cache"("symbol", "assetClass");

-- CreateIndex
CREATE INDEX "investment_audit_logs_userId_entity_entityId_idx" ON "investment_audit_logs"("userId", "entity", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "investment_settings_userId_key" ON "investment_settings"("userId");

-- AddForeignKey
ALTER TABLE "investment_assets" ADD CONSTRAINT "investment_assets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_transactions" ADD CONSTRAINT "investment_transactions_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "investment_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_incomes" ADD CONSTRAINT "investment_incomes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_incomes" ADD CONSTRAINT "investment_incomes_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "investment_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_incomes" ADD CONSTRAINT "investment_incomes_fixedIncomeId_fkey" FOREIGN KEY ("fixedIncomeId") REFERENCES "investment_fixed_incomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_fixed_incomes" ADD CONSTRAINT "investment_fixed_incomes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_contributions" ADD CONSTRAINT "investment_contributions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_cash_accounts" ADD CONSTRAINT "investment_cash_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_audit_logs" ADD CONSTRAINT "investment_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_settings" ADD CONSTRAINT "investment_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
