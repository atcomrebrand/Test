import { computeUnitEconomics, minimumPrice, suggestPrice } from "./pricing";

const SEM_TAXA = { percent: 0, fixed: 0 };

function entrada(over: Partial<Parameters<typeof computeUnitEconomics>[0]> = {}) {
  return {
    price: 100,
    cost: 50,
    packagingCost: 0,
    shippingCost: 0,
    extraCost: 0,
    channelFee: SEM_TAXA,
    taxPercent: 0,
    returnRatePercent: 0,
    ...over,
  };
}

describe("computeUnitEconomics — os três números são diferentes", () => {
  it("comprou por 50 e vendeu por 100: markup 100%, margem 50%, ROI 100%", () => {
    // É o erro clássico: calcular markup e ler como margem faz achar que ganha o dobro.
    const r = computeUnitEconomics(entrada());

    expect(r.profit).toBe(50);
    expect(r.marginPercent).toBe(50);
    expect(r.markupPercent).toBe(100);
    expect(r.roiPercent).toBe(100);
  });

  it("a taxa do canal incide sobre o PREÇO, não sobre o custo", () => {
    const r = computeUnitEconomics(entrada({ channelFee: { percent: 20, fixed: 0 } }));
    expect(r.channelFeeAmount).toBe(20); // 20% de 100, não de 50
    expect(r.profit).toBe(30);
  });

  it("a parte fixa da taxa entra inteira, independente do preço", () => {
    // Marketplace cobra "% + R$ 5 por pedido"; somar só o percentual esquece metade da conta.
    const r = computeUnitEconomics(entrada({ channelFee: { percent: 10, fixed: 5 } }));
    expect(r.channelFeeAmount).toBe(15);
    expect(r.profit).toBe(35);
  });

  it("imposto sobre faturamento incide sobre o preço", () => {
    const r = computeUnitEconomics(entrada({ taxPercent: 6 }));
    expect(r.taxAmount).toBe(6);
    expect(r.profit).toBe(44);
  });

  it("frete que VOCÊ paga é custo; o que o cliente paga não aparece aqui", () => {
    const r = computeUnitEconomics(entrada({ shippingCost: 18 }));
    expect(r.profit).toBe(32);
  });

  it("devolução esperada é perda do DESEMBOLSO, não do lucro", () => {
    // Na devolução o preço volta pro cliente e o que você gastou pra despachar não volta.
    const r = computeUnitEconomics(entrada({ cost: 50, shippingCost: 10, returnRatePercent: 10 }));
    expect(r.returnLoss).toBe(6); // 10% de (50 + 10)
    expect(r.profit).toBe(34);
  });

  it("margem de contribuição é o que sobra da venda, antes do custo fixo do mês", () => {
    const r = computeUnitEconomics(entrada({ channelFee: { percent: 20, fixed: 0 } }));
    expect(r.contributionMargin).toBe(30);
  });

  it("prejuízo aparece como prejuízo, não some", () => {
    const r = computeUnitEconomics(entrada({ price: 40 }));
    expect(r.profit).toBe(-10);
    expect(r.marginPercent).toBe(-25);
  });

  it("preço zero não vira divisão por zero", () => {
    const r = computeUnitEconomics(entrada({ price: 0 }));
    expect(r.marginPercent).toBe(0);
    expect(Number.isFinite(r.profit)).toBe(true);
  });

  it("custo zero não vira markup infinito", () => {
    const r = computeUnitEconomics(entrada({ cost: 0 }));
    expect(Number.isFinite(r.markupPercent)).toBe(true);
    expect(Number.isFinite(r.roiPercent)).toBe(true);
  });
});

describe("suggestPrice — o preço é RESOLVIDO, nunca somado", () => {
  it("custo 50, taxa 20%, margem desejada 20% → R$ 83,33 e não R$ 70", () => {
    // A conta intuitiva (50 × 1,40 = 70) aplica os percentuais sobre o custo quando eles são
    // cobrados sobre o preço. Esse é o caso que define o módulo.
    const r = suggestPrice({ ...entrada({ channelFee: { percent: 20, fixed: 0 } }), targetMarginPercent: 20 });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.price).toBe(83.33);
    expect(r.economics.marginPercent).toBe(20);
  });

  it("e o preço intuitivo entrega menos da metade da margem pedida", () => {
    // Prova de que os R$ 70 não são "quase certo": a margem real é 8,6%, não 20%.
    const r = computeUnitEconomics(entrada({ price: 70, channelFee: { percent: 20, fixed: 0 } }));
    expect(r.marginPercent).toBe(8.57);
  });

  it("a margem entregue bate com a pedida também com taxa fixa", () => {
    const r = suggestPrice({ ...entrada({ channelFee: { percent: 0, fixed: 5 } }), targetMarginPercent: 20 });
    expect(r.ok && r.price).toBe(68.75);
    expect(r.ok && r.economics.marginPercent).toBe(20);
  });

  it("a margem entregue bate com a pedida também com imposto", () => {
    const r = suggestPrice({ ...entrada({ taxPercent: 10 }), targetMarginPercent: 20 });
    expect(r.ok && r.economics.marginPercent).toBe(20);
  });

  it("taxa, imposto e margem juntos continuam batendo", () => {
    const r = suggestPrice({
      ...entrada({ channelFee: { percent: 16, fixed: 4 }, taxPercent: 6, packagingCost: 2, shippingCost: 12 }),
      targetMarginPercent: 25,
    });
    expect(r.ok && r.economics.marginPercent).toBe(25);
  });

  it("percentuais somando 100% não têm preço — e isso é dito, não calculado", () => {
    // O divisor vira zero: qualquer preço é consumido inteiro pelas taxas. Devolver "infinito" ou
    // um negativo faria a tela sugerir um preço impossível com cara de resposta.
    const r = suggestPrice({ ...entrada({ channelFee: { percent: 50, fixed: 0 }, taxPercent: 20 }), targetMarginPercent: 30 });

    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe("PERCENTUAIS_IMPOSSIVEIS");
    expect(!r.ok && r.totalPercent).toBe(100);
  });

  it("acima de 100% também é recusado", () => {
    const r = suggestPrice({ ...entrada({ channelFee: { percent: 60, fixed: 0 } }), targetMarginPercent: 60 });
    expect(r.ok).toBe(false);
  });

  it("99% ainda é possível, mesmo que o preço fique alto", () => {
    const r = suggestPrice({ ...entrada({ channelFee: { percent: 90, fixed: 0 } }), targetMarginPercent: 9 });
    expect(r.ok).toBe(true);
    expect(r.ok && r.price).toBe(5000);
  });

  it("a devolução esperada encarece o preço sugerido", () => {
    const sem = suggestPrice({ ...entrada(), targetMarginPercent: 20 });
    const com = suggestPrice({ ...entrada({ returnRatePercent: 10 }), targetMarginPercent: 20 });
    expect(com.ok && sem.ok && com.price > sem.price).toBe(true);
  });
});

describe("minimumPrice — o piso", () => {
  it("é o preço de margem zero", () => {
    const r = minimumPrice(entrada({ channelFee: { percent: 20, fixed: 0 } }));
    expect(r.ok && r.price).toBe(62.5);
    expect(r.ok && r.economics.profit).toBe(0);
  });

  it("com devolução esperada, o piso cobre a perda", () => {
    const r = minimumPrice(entrada({ cost: 50, returnRatePercent: 10 }));
    expect(r.ok && r.price).toBe(55);
    expect(r.ok && r.economics.profit).toBe(0);
  });

  it("vender abaixo do piso é prejuízo, e a conta mostra isso", () => {
    const piso = minimumPrice(entrada({ channelFee: { percent: 20, fixed: 0 } }));
    const abaixo = computeUnitEconomics(entrada({ price: 60, channelFee: { percent: 20, fixed: 0 } }));
    expect(piso.ok && piso.price).toBe(62.5);
    expect(abaixo.profit).toBeLessThan(0);
  });
});
