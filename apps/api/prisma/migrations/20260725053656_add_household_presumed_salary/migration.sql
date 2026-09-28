-- CreateTable
CREATE TABLE "household_presumed_salaries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isForeignCurrency" BOOLEAN NOT NULL DEFAULT false,
    "amountBRL" DECIMAL(12,2),
    "amountUsd" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "household_presumed_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "household_presumed_salaries_userId_key" ON "household_presumed_salaries"("userId");

-- AddForeignKey
ALTER TABLE "household_presumed_salaries" ADD CONSTRAINT "household_presumed_salaries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
