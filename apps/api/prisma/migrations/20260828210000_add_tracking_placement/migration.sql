-- Colocação diária do serviço com ranking.
-- Tudo aditivo: colunas novas, nullable (ou com default), sem tocar em nada que já existe.
ALTER TABLE "tracking_jobs" ADD COLUMN "tracksPlacement" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "tracking_sessions" ADD COLUMN "placement" INTEGER;
ALTER TABLE "tracking_sessions" ADD COLUMN "satisfactionPercent" DECIMAL(5,2);
ALTER TABLE "tracking_sessions" ADD COLUMN "responseMinutes" INTEGER;
