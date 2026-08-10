/**
 * Patrimônio de um bem financiado: o que ele vale hoje menos o que falta pagar pra quitá-lo.
 *
 * Sem o valor do bem, o app só enxergava a dívida — um carro de R$ 60.000 com R$ 20.000 de
 * quitação aparecia como −R$ 20.000 de patrimônio, quando na verdade são +R$ 40.000. É a metade
 * que faltava pra conta fechar.
 */

export interface FinancingEquityInput {
  /** Quanto o bem vale hoje (FIPE/avaliação). null = nunca foi informado. */
  assetValue: number | null;
  /** Quitação à vista mais recente. null = nunca foi cotada. */
  payoffAmount: number | null;
  /** Soma das parcelas que ainda faltam — só entra como último recurso, quando não há cotação. */
  remainingInstallments: number;
}

export type FinancingDebtSource = "PAYOFF_QUOTE" | "REMAINING_INSTALLMENTS";

export interface FinancingEquityResult {
  assetValue: number | null;
  debt: number;
  debtSource: FinancingDebtSource;
  /** Valor do bem menos a dívida. null quando o bem não tem valor informado — deixar 0 aqui seria
   *  inventar que o bem não vale nada, e o número entraria no patrimônio como se fosse fato. */
  equity: number | null;
  /** Quanto do bem já é seu, em %. null pelo mesmo motivo, ou se o bem vale 0. */
  equityPercent: number | null;
  /** true quando a dívida passou do valor do bem — vale menos do que se deve nele. */
  underwater: boolean;
}

export function computeFinancingEquity({ assetValue, payoffAmount, remainingInstallments }: FinancingEquityInput): FinancingEquityResult {
  // A quitação é a dívida real: a soma das parcelas restantes embute juro futuro que ainda não
  // venceu, então superestima. Mesma regra já usada no patrimônio da Home.
  const usaCotacao = payoffAmount !== null && payoffAmount >= 0;
  const debt = Math.max(0, usaCotacao ? (payoffAmount as number) : remainingInstallments);
  const debtSource: FinancingDebtSource = usaCotacao ? "PAYOFF_QUOTE" : "REMAINING_INSTALLMENTS";

  if (assetValue === null) {
    return { assetValue: null, debt, debtSource, equity: null, equityPercent: null, underwater: false };
  }

  const valor = Math.max(0, assetValue);
  const equity = valor - debt;
  return {
    assetValue: valor,
    debt,
    debtSource,
    equity,
    equityPercent: valor > 0 ? Math.round((equity / valor) * 1000) / 10 : null,
    underwater: equity < 0,
  };
}

export interface FinancingEquityTotals {
  /** Soma dos bens que têm valor informado. */
  assetsValue: number;
  /** Dívida de todos os financiamentos ativos, tenham valor de bem ou não. */
  debt: number;
  /** assetsValue − debt. Conta só os bens conhecidos; a dívida entra inteira. */
  equity: number;
  /** Quantos financiamentos ativos ainda estão sem valor do bem — a tela usa isso pra avisar que
   *  o patrimônio está incompleto em vez de mostrar um número que parece definitivo. */
  withoutAssetValue: number;
}

export function sumFinancingEquity(items: FinancingEquityInput[]): FinancingEquityTotals {
  let assetsValue = 0;
  let debt = 0;
  let withoutAssetValue = 0;

  for (const item of items) {
    const result = computeFinancingEquity(item);
    debt += result.debt;
    if (result.assetValue === null) withoutAssetValue++;
    else assetsValue += result.assetValue;
  }

  return { assetsValue, debt, equity: assetsValue - debt, withoutAssetValue };
}
