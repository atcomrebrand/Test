-- Dinheiro efetivamente aportado que ainda está na aplicação, separado do principalAmount (que é a
-- base de rendimento e encolhe proporcionalmente num resgate parcial). Nullable de propósito: toda
-- linha existente fica NULL e o código lê como "igual ao principalAmount", que é exatamente o que
-- era verdade antes de existir resgate parcial.
ALTER TABLE "investment_fixed_incomes" ADD COLUMN "contributedAmount" DECIMAL(14,2);
