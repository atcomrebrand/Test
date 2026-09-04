export interface NetWorthInput {
  /** Valor atual da carteira de investimentos (ações/FIIs/cripto/renda fixa + caixa). */
  investedAssets: number;
  /** Valor de mercado dos bens financiados (FIPE do carro, avaliação do imóvel). Entra como ativo
   *  porque a dívida do financiamento já é abatida em totalDebt — contar só a dívida deixava um
   *  carro de R$ 60.000 aparecendo como −R$ 20.000 de patrimônio em vez de +R$ 40.000. Bem sem
   *  avaliação informada simplesmente não entra: contaria como zero e o líquido ficaria pessimista. */
  financedAssets?: number;
  /** Dívida a abater do patrimônio — hoje só financiamento (dívida de longo prazo). Gasto de
   *  cartão (Parcelas) fica de fora de propósito: é comprometido/já conhecido do mês, não uma
   *  dívida pra abater do patrimônio do mesmo jeito que financiamento. */
  totalDebt: number;
}

export interface NetWorthResult {
  assets: number;
  /** Quanto dos ativos vem da carteira de investimentos… */
  investedAssets: number;
  /** …e quanto vem de bem financiado avaliado. Os dois somam `assets`. */
  financedAssets: number;
  debts: number;
  netWorth: number;
  /** % da dívida sobre os ativos — null quando não há ativos (divisão indefinida, não faz sentido mostrar 0%). */
  debtToAssetPct: number | null;
}

export function calculateNetWorth({ investedAssets, financedAssets = 0, totalDebt }: NetWorthInput): NetWorthResult {
  const invested = Math.max(0, investedAssets);
  const financed = Math.max(0, financedAssets);
  const assets = invested + financed;
  const debts = Math.max(0, totalDebt);
  return {
    assets,
    investedAssets: invested,
    financedAssets: financed,
    debts,
    netWorth: assets - debts,
    debtToAssetPct: assets > 0 ? Math.round((debts / assets) * 1000) / 10 : null,
  };
}
