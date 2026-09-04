-- CreateTable
CREATE TABLE "historical_prices" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "close" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "historical_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "historical_prices_ticker_idx" ON "historical_prices"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "historical_prices_ticker_date_key" ON "historical_prices"("ticker", "date");
