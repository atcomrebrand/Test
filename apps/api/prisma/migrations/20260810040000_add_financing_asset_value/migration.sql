-- Valor de mercado do bem financiado (FIPE pro veículo, avaliação pro imóvel) + histórico.
-- Aditivo: colunas nullable e tabela nova, nada existente é tocado.
ALTER TABLE "financings" ADD COLUMN "assetValue" DECIMAL(12,2);
ALTER TABLE "financings" ADD COLUMN "assetValueAt" TIMESTAMP(3);

CREATE TABLE "financing_asset_values" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "financingId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "source" TEXT,
    "valuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financing_asset_values_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "financing_asset_values_financingId_valuedAt_idx" ON "financing_asset_values"("financingId", "valuedAt");

ALTER TABLE "financing_asset_values" ADD CONSTRAINT "financing_asset_values_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financing_asset_values" ADD CONSTRAINT "financing_asset_values_financingId_fkey"
  FOREIGN KEY ("financingId") REFERENCES "financings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
