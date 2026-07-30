export interface FinancingForPayoffDebt {
  active: boolean;
  /** Última cotação de quitação à vista informada pelo usuário — null se nunca foi cotada. */
  payoffAmount: number | null;
  installments: { status: string; amount: number }[];
}

/**
 * Dívida de financiamento pro patrimônio líquido: usa a quitação à vista ("quanto pagaria pra
 * quitar hoje"), não a soma nominal das parcelas restantes — essa soma inclui juros futuros que
 * ainda nem venceram, superestimando a dívida real. Quando o financiamento nunca foi cotado
 * (payoffAmount null), cai de volta pra soma das parcelas PENDING/LATE daquele financiamento
 * como aproximação, já que não há outro número disponível.
 */
export function computeFinancingPayoffDebt(financings: FinancingForPayoffDebt[]): number {
  return financings
    .filter((f) => f.active)
    .reduce((total, f) => {
      if (f.payoffAmount !== null) return total + f.payoffAmount;
      const remaining = f.installments
        .filter((i) => i.status === "PENDING" || i.status === "LATE")
        .reduce((sum, i) => sum + i.amount, 0);
      return total + remaining;
    }, 0);
}
