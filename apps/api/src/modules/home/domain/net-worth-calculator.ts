export interface NetWorthInput {
  /** Valor atual da carteira de investimentos (ações/FIIs/cripto/renda fixa + caixa). */
  investedAssets: number;
  /** Dívidas totais já livres de dupla contagem — cartões do Parcelamento + financiamentos. */
  totalDebt: number;
}

export interface NetWorthResult {
  assets: number;
  debts: number;
  netWorth: number;
  /** % da dívida sobre os ativos — null quando não há ativos (divisão indefinida, não faz sentido mostrar 0%). */
  debtToAssetPct: number | null;
}

export function calculateNetWorth({ investedAssets, totalDebt }: NetWorthInput): NetWorthResult {
  const assets = Math.max(0, investedAssets);
  const debts = Math.max(0, totalDebt);
  return {
    assets,
    debts,
    netWorth: assets - debts,
    debtToAssetPct: assets > 0 ? Math.round((debts / assets) * 1000) / 10 : null,
  };
}
