-- CreateEnum
CREATE TYPE "HouseholdBillStatus" AS ENUM ('PENDING', 'PARTIALLY_RESERVED', 'RESERVED', 'PAID', 'LATE');

-- CreateTable
CREATE TABLE "household_bill_categories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'tag',
    "color" TEXT NOT NULL DEFAULT '#8B8B8B',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_bill_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_income_categories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'wallet',
    "color" TEXT NOT NULL DEFAULT '#8B8B8B',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_income_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_bills" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "defaultAmount" DECIMAL(12,2) NOT NULL,
    "allowAmountChange" BOOLEAN NOT NULL DEFAULT true,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_bill_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "referenceYear" INTEGER NOT NULL,
    "referenceMonth" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reservedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "status" "HouseholdBillStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_bill_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_cards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "closingDay" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6D5BFF',
    "icon" TEXT NOT NULL DEFAULT 'credit-card',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_card_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "referenceYear" INTEGER NOT NULL,
    "referenceMonth" INTEGER NOT NULL,
    "totalInvoice" DECIMAL(12,2) NOT NULL,
    "provisioned" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_card_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_incomes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "household_bill_categories_userId_idx" ON "household_bill_categories"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "household_bill_categories_userId_name_key" ON "household_bill_categories"("userId", "name");

-- CreateIndex
CREATE INDEX "household_income_categories_userId_idx" ON "household_income_categories"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "household_income_categories_userId_name_key" ON "household_income_categories"("userId", "name");

-- CreateIndex
CREATE INDEX "household_bills_userId_active_idx" ON "household_bills"("userId", "active");

-- CreateIndex
CREATE INDEX "household_bill_entries_userId_referenceYear_referenceMonth_idx" ON "household_bill_entries"("userId", "referenceYear", "referenceMonth");

-- CreateIndex
CREATE INDEX "household_bill_entries_userId_status_idx" ON "household_bill_entries"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "household_bill_entries_billId_referenceYear_referenceMonth_key" ON "household_bill_entries"("billId", "referenceYear", "referenceMonth");

-- CreateIndex
CREATE INDEX "household_cards_userId_active_idx" ON "household_cards"("userId", "active");

-- CreateIndex
CREATE INDEX "household_card_entries_userId_referenceYear_referenceMonth_idx" ON "household_card_entries"("userId", "referenceYear", "referenceMonth");

-- CreateIndex
CREATE UNIQUE INDEX "household_card_entries_cardId_referenceYear_referenceMonth_key" ON "household_card_entries"("cardId", "referenceYear", "referenceMonth");

-- CreateIndex
CREATE INDEX "household_incomes_userId_date_idx" ON "household_incomes"("userId", "date");

-- CreateIndex
CREATE INDEX "household_incomes_categoryId_idx" ON "household_incomes"("categoryId");

-- CreateIndex
CREATE INDEX "household_audit_logs_userId_entity_entityId_idx" ON "household_audit_logs"("userId", "entity", "entityId");

-- AddForeignKey
ALTER TABLE "household_bill_categories" ADD CONSTRAINT "household_bill_categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_income_categories" ADD CONSTRAINT "household_income_categories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_bills" ADD CONSTRAINT "household_bills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_bills" ADD CONSTRAINT "household_bills_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "household_bill_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_bill_entries" ADD CONSTRAINT "household_bill_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_bill_entries" ADD CONSTRAINT "household_bill_entries_billId_fkey" FOREIGN KEY ("billId") REFERENCES "household_bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_cards" ADD CONSTRAINT "household_cards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_card_entries" ADD CONSTRAINT "household_card_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_card_entries" ADD CONSTRAINT "household_card_entries_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "household_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_incomes" ADD CONSTRAINT "household_incomes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_incomes" ADD CONSTRAINT "household_incomes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "household_income_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_audit_logs" ADD CONSTRAINT "household_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
