-- CreateEnum
CREATE TYPE "CrmCurrency" AS ENUM ('BRL', 'USD');

-- CreateEnum
CREATE TYPE "CrmPanelMovementKind" AS ENUM ('RECHARGE', 'CONSUMPTION', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "crm_plans" ADD COLUMN     "creditCost" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "crm_portfolios" ADD COLUMN     "currency" "CrmCurrency" NOT NULL DEFAULT 'BRL';

-- AlterTable
ALTER TABLE "crm_settings" ADD COLUMN     "deductResellerRechargesFromPanel" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "panelLowCreditThreshold" INTEGER NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "crm_subscriptions" ADD COLUMN     "creditCost" INTEGER;

-- CreateTable
CREATE TABLE "crm_panel_recharges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" "CrmCurrency" NOT NULL DEFAULT 'BRL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_panel_recharges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_panel_credit_movements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "kind" "CrmPanelMovementKind" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "panelRechargeId" TEXT,
    "subscriptionId" TEXT,
    "customerId" TEXT,
    "rechargeId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_panel_credit_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_panel_recharges_userId_portfolioId_date_idx" ON "crm_panel_recharges"("userId", "portfolioId", "date");

-- CreateIndex
CREATE INDEX "crm_panel_credit_movements_userId_portfolioId_createdAt_idx" ON "crm_panel_credit_movements"("userId", "portfolioId", "createdAt");

-- AddForeignKey
ALTER TABLE "crm_panel_recharges" ADD CONSTRAINT "crm_panel_recharges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_panel_recharges" ADD CONSTRAINT "crm_panel_recharges_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "crm_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_panel_credit_movements" ADD CONSTRAINT "crm_panel_credit_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_panel_credit_movements" ADD CONSTRAINT "crm_panel_credit_movements_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "crm_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_panel_credit_movements" ADD CONSTRAINT "crm_panel_credit_movements_panelRechargeId_fkey" FOREIGN KEY ("panelRechargeId") REFERENCES "crm_panel_recharges"("id") ON DELETE SET NULL ON UPDATE CASCADE;
