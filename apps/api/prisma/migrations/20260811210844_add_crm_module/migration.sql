-- CreateEnum
CREATE TYPE "CrmCustomerStatus" AS ENUM ('LEAD', 'TRIAL', 'ACTIVE', 'DUE_SOON', 'LATE', 'DELINQUENT', 'CANCELLED', 'INACTIVE', 'RECOVERY');

-- CreateEnum
CREATE TYPE "CrmSubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CrmLeadStage" AS ENUM ('NEW', 'CONTACTED', 'INTERESTED', 'TRIAL', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "CrmResellerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'NEGOTIATING', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CrmCreditMovementKind" AS ENUM ('RECHARGE', 'USAGE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CrmTemplateCategory" AS ENUM ('RENEWAL', 'DUE', 'DELINQUENCY', 'RETENTION', 'SUPPORT', 'WELCOME', 'RESELLER', 'OTHER');

-- CreateEnum
CREATE TYPE "CrmBillingPeriod" AS ENUM ('MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM');

-- CreateTable
CREATE TABLE "crm_portfolios" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "billingPeriod" "CrmBillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "customDays" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_payment_methods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "feePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "feeFixed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_origins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_origins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_tags" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_customer_tags" (
    "customerId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "crm_customer_tags_pkey" PRIMARY KEY ("customerId","tagId")
);

-- CreateTable
CREATE TABLE "crm_reseller_tags" (
    "resellerId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "crm_reseller_tags_pkey" PRIMARY KEY ("resellerId","tagId")
);

-- CreateTable
CREATE TABLE "crm_lead_tags" (
    "leadId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "crm_lead_tags_pkey" PRIMARY KEY ("leadId","tagId")
);

-- CreateTable
CREATE TABLE "crm_customers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT,
    "document" TEXT,
    "originId" TEXT,
    "referredById" TEXT,
    "currentDueDate" TIMESTAMP(3),
    "manualStatus" "CrmCustomerStatus",
    "trialEndsAt" TIMESTAMP(3),
    "firstSubscribedAt" TIMESTAMP(3),
    "vip" BOOLEAN NOT NULL DEFAULT false,
    "vipManual" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "planId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "billingPeriod" "CrmBillingPeriod" NOT NULL DEFAULT 'MONTHLY',
    "customDays" INTEGER,
    "paymentMethodId" TEXT,
    "status" "CrmSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastPaymentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "portfolioId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "grossAmount" DECIMAL(12,2) NOT NULL,
    "feePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "feeFixed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "feeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "paymentMethodId" TEXT,
    "paymentMethodName" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_customer_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_customer_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_leads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "originId" TEXT,
    "stage" "CrmLeadStage" NOT NULL DEFAULT 'NEW',
    "lastContactAt" TIMESTAMP(3),
    "nextContactAt" TIMESTAMP(3),
    "convertedCustomerId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_resellers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "companyName" TEXT,
    "phone" TEXT NOT NULL,
    "whatsapp" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_resellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_reseller_portfolios" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "status" "CrmResellerStatus" NOT NULL DEFAULT 'ACTIVE',
    "creditPrice" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "approxActiveClients" INTEGER NOT NULL DEFAULT 0,
    "approxUpdatedAt" TIMESTAMP(3),
    "lowCreditThreshold" INTEGER NOT NULL DEFAULT 10,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_reseller_portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_recharges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resellerPortfolioId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paymentMethodId" TEXT,
    "paymentMethodName" TEXT,
    "feePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "feeFixed" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "feeAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netAmount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_recharges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_credit_movements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resellerPortfolioId" TEXT NOT NULL,
    "kind" "CrmCreditMovementKind" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "rechargeId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_credit_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_credit_price_changes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resellerPortfolioId" TEXT NOT NULL,
    "previousPrice" DECIMAL(12,2) NOT NULL,
    "newPrice" DECIMAL(12,2) NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_credit_price_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_approx_clients_changes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resellerPortfolioId" TEXT NOT NULL,
    "previousValue" INTEGER NOT NULL,
    "newValue" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_approx_clients_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_message_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CrmTemplateCategory" NOT NULL DEFAULT 'OTHER',
    "body" TEXT NOT NULL,
    "forReseller" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vipMinMonths" INTEGER,
    "vipMinRevenue" DECIMAL(12,2),
    "vipMinRenewals" INTEGER,
    "resellerAttentionDays" INTEGER NOT NULL DEFAULT 30,
    "resellerInactiveDays" INTEGER NOT NULL DEFAULT 60,
    "defaultLowCreditThreshold" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_portfolios_userId_active_idx" ON "crm_portfolios"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "crm_portfolios_userId_name_key" ON "crm_portfolios"("userId", "name");

-- CreateIndex
CREATE INDEX "crm_plans_userId_portfolioId_active_idx" ON "crm_plans"("userId", "portfolioId", "active");

-- CreateIndex
CREATE INDEX "crm_payment_methods_userId_active_idx" ON "crm_payment_methods"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "crm_payment_methods_userId_name_key" ON "crm_payment_methods"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "crm_origins_userId_name_key" ON "crm_origins"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "crm_tags_userId_name_key" ON "crm_tags"("userId", "name");

-- CreateIndex
CREATE INDEX "crm_customers_userId_portfolioId_deletedAt_idx" ON "crm_customers"("userId", "portfolioId", "deletedAt");

-- CreateIndex
CREATE INDEX "crm_customers_userId_currentDueDate_idx" ON "crm_customers"("userId", "currentDueDate");

-- CreateIndex
CREATE INDEX "crm_customers_userId_phone_idx" ON "crm_customers"("userId", "phone");

-- CreateIndex
CREATE INDEX "crm_subscriptions_userId_customerId_idx" ON "crm_subscriptions"("userId", "customerId");

-- CreateIndex
CREATE INDEX "crm_subscriptions_userId_portfolioId_status_idx" ON "crm_subscriptions"("userId", "portfolioId", "status");

-- CreateIndex
CREATE INDEX "crm_payments_userId_portfolioId_paidAt_idx" ON "crm_payments"("userId", "portfolioId", "paidAt");

-- CreateIndex
CREATE INDEX "crm_payments_userId_customerId_paidAt_idx" ON "crm_payments"("userId", "customerId", "paidAt");

-- CreateIndex
CREATE INDEX "crm_customer_events_userId_customerId_createdAt_idx" ON "crm_customer_events"("userId", "customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "crm_leads_convertedCustomerId_key" ON "crm_leads"("convertedCustomerId");

-- CreateIndex
CREATE INDEX "crm_leads_userId_portfolioId_stage_idx" ON "crm_leads"("userId", "portfolioId", "stage");

-- CreateIndex
CREATE INDEX "crm_leads_userId_nextContactAt_idx" ON "crm_leads"("userId", "nextContactAt");

-- CreateIndex
CREATE INDEX "crm_resellers_userId_deletedAt_idx" ON "crm_resellers"("userId", "deletedAt");

-- CreateIndex
CREATE INDEX "crm_resellers_userId_phone_idx" ON "crm_resellers"("userId", "phone");

-- CreateIndex
CREATE INDEX "crm_reseller_portfolios_userId_portfolioId_status_idx" ON "crm_reseller_portfolios"("userId", "portfolioId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "crm_reseller_portfolios_resellerId_portfolioId_key" ON "crm_reseller_portfolios"("resellerId", "portfolioId");

-- CreateIndex
CREATE INDEX "crm_recharges_userId_portfolioId_date_idx" ON "crm_recharges"("userId", "portfolioId", "date");

-- CreateIndex
CREATE INDEX "crm_recharges_resellerPortfolioId_date_idx" ON "crm_recharges"("resellerPortfolioId", "date");

-- CreateIndex
CREATE INDEX "crm_credit_movements_resellerPortfolioId_createdAt_idx" ON "crm_credit_movements"("resellerPortfolioId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_credit_movements_userId_createdAt_idx" ON "crm_credit_movements"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "crm_credit_price_changes_resellerPortfolioId_changedAt_idx" ON "crm_credit_price_changes"("resellerPortfolioId", "changedAt");

-- CreateIndex
CREATE INDEX "crm_approx_clients_changes_resellerPortfolioId_changedAt_idx" ON "crm_approx_clients_changes"("resellerPortfolioId", "changedAt");

-- CreateIndex
CREATE INDEX "crm_message_templates_userId_active_idx" ON "crm_message_templates"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "crm_settings_userId_key" ON "crm_settings"("userId");

-- CreateIndex
CREATE INDEX "crm_audit_logs_userId_entity_entityId_idx" ON "crm_audit_logs"("userId", "entity", "entityId");

-- CreateIndex
CREATE INDEX "crm_audit_logs_userId_createdAt_idx" ON "crm_audit_logs"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "crm_portfolios" ADD CONSTRAINT "crm_portfolios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_plans" ADD CONSTRAINT "crm_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_plans" ADD CONSTRAINT "crm_plans_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "crm_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_payment_methods" ADD CONSTRAINT "crm_payment_methods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_origins" ADD CONSTRAINT "crm_origins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_tags" ADD CONSTRAINT "crm_tags_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_tags" ADD CONSTRAINT "crm_customer_tags_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "crm_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_tags" ADD CONSTRAINT "crm_customer_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "crm_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_reseller_tags" ADD CONSTRAINT "crm_reseller_tags_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "crm_resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_reseller_tags" ADD CONSTRAINT "crm_reseller_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "crm_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_tags" ADD CONSTRAINT "crm_lead_tags_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_lead_tags" ADD CONSTRAINT "crm_lead_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "crm_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customers" ADD CONSTRAINT "crm_customers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customers" ADD CONSTRAINT "crm_customers_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "crm_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customers" ADD CONSTRAINT "crm_customers_originId_fkey" FOREIGN KEY ("originId") REFERENCES "crm_origins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customers" ADD CONSTRAINT "crm_customers_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "crm_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_subscriptions" ADD CONSTRAINT "crm_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_subscriptions" ADD CONSTRAINT "crm_subscriptions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "crm_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_subscriptions" ADD CONSTRAINT "crm_subscriptions_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "crm_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_subscriptions" ADD CONSTRAINT "crm_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "crm_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_subscriptions" ADD CONSTRAINT "crm_subscriptions_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "crm_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_payments" ADD CONSTRAINT "crm_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_payments" ADD CONSTRAINT "crm_payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "crm_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_payments" ADD CONSTRAINT "crm_payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "crm_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_payments" ADD CONSTRAINT "crm_payments_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "crm_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_events" ADD CONSTRAINT "crm_customer_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_customer_events" ADD CONSTRAINT "crm_customer_events_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "crm_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "crm_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_originId_fkey" FOREIGN KEY ("originId") REFERENCES "crm_origins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_convertedCustomerId_fkey" FOREIGN KEY ("convertedCustomerId") REFERENCES "crm_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_resellers" ADD CONSTRAINT "crm_resellers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_reseller_portfolios" ADD CONSTRAINT "crm_reseller_portfolios_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_reseller_portfolios" ADD CONSTRAINT "crm_reseller_portfolios_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "crm_resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_reseller_portfolios" ADD CONSTRAINT "crm_reseller_portfolios_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "crm_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_recharges" ADD CONSTRAINT "crm_recharges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_recharges" ADD CONSTRAINT "crm_recharges_resellerPortfolioId_fkey" FOREIGN KEY ("resellerPortfolioId") REFERENCES "crm_reseller_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_recharges" ADD CONSTRAINT "crm_recharges_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "crm_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_credit_movements" ADD CONSTRAINT "crm_credit_movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_credit_movements" ADD CONSTRAINT "crm_credit_movements_resellerPortfolioId_fkey" FOREIGN KEY ("resellerPortfolioId") REFERENCES "crm_reseller_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_credit_movements" ADD CONSTRAINT "crm_credit_movements_rechargeId_fkey" FOREIGN KEY ("rechargeId") REFERENCES "crm_recharges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_credit_price_changes" ADD CONSTRAINT "crm_credit_price_changes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_credit_price_changes" ADD CONSTRAINT "crm_credit_price_changes_resellerPortfolioId_fkey" FOREIGN KEY ("resellerPortfolioId") REFERENCES "crm_reseller_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_approx_clients_changes" ADD CONSTRAINT "crm_approx_clients_changes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_approx_clients_changes" ADD CONSTRAINT "crm_approx_clients_changes_resellerPortfolioId_fkey" FOREIGN KEY ("resellerPortfolioId") REFERENCES "crm_reseller_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_message_templates" ADD CONSTRAINT "crm_message_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_settings" ADD CONSTRAINT "crm_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_audit_logs" ADD CONSTRAINT "crm_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
