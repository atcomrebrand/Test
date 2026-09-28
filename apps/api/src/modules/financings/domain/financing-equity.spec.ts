import { computeFinancingEquity, sumFinancingEquity } from "./financing-equity";

describe("computeFinancingEquity", () => {
  it("patrimônio é o que o bem vale menos o que falta pra quitar", () => {
    const result = computeFinancingEquity({ assetValue: 60000, payoffAmount: 20000, remainingInstallments: 26000 });

    expect(result.equity).toBe(40000);
    expect(result.debt).toBe(20000);
    expect(result.debtSource).toBe("PAYOFF_QUOTE");
    expect(result.equityPercent).toBe(66.7);
    expect(result.underwater).toBe(false);
  });

  /** A soma das parcelas restantes embute juro futuro que ainda não venceu — superestima a dívida. */
  it("prefere a quitação à vista à soma das parcelas restantes", () => {
    const comCotacao = computeFinancingEquity({ assetValue: 60000, payoffAmount: 20000, remainingInstallments: 26000 });
    const semCotacao = computeFinancingEquity({ assetValue: 60000, payoffAmount: null, remainingInstallments: 26000 });

    expect(comCotacao.debt).toBe(20000);
    expect(semCotacao.debt).toBe(26000);
    expect(semCotacao.debtSource).toBe("REMAINING_INSTALLMENTS");
    expect(semCotacao.equity).toBe(34000);
  });

  /**
   * Sem valor do bem o patrimônio é desconhecido, não zero. Devolver 0 faria o número entrar nas
   * somas como se fosse fato — e um carro sem FIPE informada apareceria como dívida pura.
   */
  it("devolve null quando o bem não tem valor informado, em vez de assumir zero", () => {
    const result = computeFinancingEquity({ assetValue: null, payoffAmount: 20000, remainingInstallments: 26000 });

    expect(result.equity).toBeNull();
    expect(result.equityPercent).toBeNull();
    expect(result.assetValue).toBeNull();
    expect(result.debt).toBe(20000); // a dívida continua conhecida
  });

  it("marca quando se deve mais do que o bem vale", () => {
    const result = computeFinancingEquity({ assetValue: 30000, payoffAmount: 42000, remainingInstallments: 50000 });

    expect(result.equity).toBe(-12000);
    expect(result.underwater).toBe(true);
    expect(result.equityPercent).toBe(-40);
  });

  it("bem já quitado é patrimônio inteiro", () => {
    const result = computeFinancingEquity({ assetValue: 60000, payoffAmount: 0, remainingInstallments: 0 });

    expect(result.equity).toBe(60000);
    expect(result.equityPercent).toBe(100);
    expect(result.debtSource).toBe("PAYOFF_QUOTE"); // cotação de 0 é uma cotação, não "sem cotação"
  });

  it("não divide por zero quando o bem vale zero", () => {
    const result = computeFinancingEquity({ assetValue: 0, payoffAmount: 5000, remainingInstallments: 5000 });

    expect(result.equity).toBe(-5000);
    expect(result.equityPercent).toBeNull();
  });
});

describe("sumFinancingEquity", () => {
  it("soma os bens conhecidos e a dívida inteira, e conta quantos faltam avaliar", () => {
    const totals = sumFinancingEquity([
      { assetValue: 60000, payoffAmount: 20000, remainingInstallments: 26000 },
      { assetValue: 250000, payoffAmount: 180000, remainingInstallments: 220000 },
      { assetValue: null, payoffAmount: 8000, remainingInstallments: 9000 },
    ]);

    expect(totals.assetsValue).toBe(310000);
    expect(totals.debt).toBe(208000); // inclui os 8.000 do bem sem valor
    expect(totals.equity).toBe(102000);
    expect(totals.withoutAssetValue).toBe(1);
  });

  it("sem financiamento nenhum, tudo zero e nada pendente de avaliação", () => {
    expect(sumFinancingEquity([])).toEqual({ assetsValue: 0, debt: 0, equity: 0, withoutAssetValue: 0 });
  });

  /** O patrimônio agregado fica pessimista enquanto houver bem sem avaliar — e é por isso que
   *  withoutAssetValue existe: a tela avisa em vez de mostrar um número que parece completo. */
  it("com todos os bens sem valor, sobra só a dívida", () => {
    const totals = sumFinancingEquity([
      { assetValue: null, payoffAmount: 20000, remainingInstallments: 26000 },
      { assetValue: null, payoffAmount: null, remainingInstallments: 9000 },
    ]);

    expect(totals.assetsValue).toBe(0);
    expect(totals.debt).toBe(29000);
    expect(totals.equity).toBe(-29000);
    expect(totals.withoutAssetValue).toBe(2);
  });
});
