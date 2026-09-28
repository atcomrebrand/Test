-- Cache da série diária de indicadores do Bacen (SGS). Tabela nova, não mexe em nada existente.
-- A taxa de um dia útil que já passou nunca muda, então uma vez gravada ela é reusada pra sempre.
CREATE TABLE "economic_daily_rates" (
    "id" TEXT NOT NULL,
    "series" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "value" DECIMAL(12,8) NOT NULL,

    CONSTRAINT "economic_daily_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "economic_daily_rates_series_date_key" ON "economic_daily_rates"("series", "date");
CREATE INDEX "economic_daily_rates_series_date_idx" ON "economic_daily_rates"("series", "date");
