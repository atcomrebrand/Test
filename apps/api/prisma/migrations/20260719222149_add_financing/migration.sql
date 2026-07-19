-- CreateEnum
CREATE TYPE "FinancingKind" AS ENUM ('CAR', 'MOTORCYCLE', 'HOUSE', 'OTHER');

-- CreateEnum
CREATE TYPE "FinancingInstallmentStatus" AS ENUM ('PENDING', 'PAID', 'LATE', 'CANCELLED');

-- CreateTable
CREATE TABLE "financings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FinancingKind" NOT NULL DEFAULT 'OTHER',
    "institution" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "installmentAmount" DECIMAL(12,2) NOT NULL,
    "installmentsCount" INTEGER NOT NULL,
    "firstDueDate" TIMESTAMP(3) NOT NULL,
    "payoffAmount" DECIMAL(12,2),
    "payoffQuotedAt" TIMESTAMP(3),
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financing_installments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financingId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "FinancingInstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paidAmount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financing_installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "financings_userId_active_idx" ON "financings"("userId", "active");

-- CreateIndex
CREATE INDEX "financing_installments_userId_status_idx" ON "financing_installments"("userId", "status");

-- CreateIndex
CREATE INDEX "financing_installments_userId_dueDate_idx" ON "financing_installments"("userId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "financing_installments_financingId_number_key" ON "financing_installments"("financingId", "number");

-- AddForeignKey
ALTER TABLE "financings" ADD CONSTRAINT "financings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financing_installments" ADD CONSTRAINT "financing_installments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financing_installments" ADD CONSTRAINT "financing_installments_financingId_fkey" FOREIGN KEY ("financingId") REFERENCES "financings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
