import {
  accrueCdiFactor,
  businessDaysBetween,
  calculateFixedIncome,
  effectiveAnnualRateForCdi,
  nextBusinessDay,
  principalForTargetNetValue,
  splitContribution,
} from "./fixed-income-calculator";

function daysAfter(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

describe("calculateFixedIncome", () => {
  const applicationDate = new Date("2024-01-01T12:00:00Z");

  it("computes gross value with compound interest for PREFIXADO", () => {
    const result = calculateFixedIncome({
      principalAmount: 10000,
      applicationDate,
      asOfDate: daysAfter(applicationDate, 365),
      type: "CDB",
      indexer: "PREFIXADO",
      fixedRatePercent: 12,
    });

    expect(result.grossValue).toBeCloseTo(11200, 0);
    expect(result.grossYield).toBeCloseTo(1200, 0);
  });

  it("applies POS_FIXADO_CDI compounding cdiPercent of the DAILY CDI rate, not of the annual one", () => {
    const result = calculateFixedIncome({
      principalAmount: 10000,
      applicationDate,
      asOfDate: daysAfter(applicationDate, 365),
      type: "CDB",
      indexer: "POS_FIXADO_CDI",
      cdiPercent: 110,
      cdiAnnualRate: 10,
    });

    // 110% do CDI não é 11% a.a. (a conta linear que este teste cobrava antes, e que deixava o app
    // abaixo do banco): o percentual incide sobre a taxa diária e capitaliza em 252 dias úteis,
    // dando 11,0533% a.a. Ver effectiveAnnualRateForCdi.
    expect(result.grossValue).toBeCloseTo(11105.33, 1);
    expect(result.grossValue).toBeGreaterThan(11100);
  });

  it("compounds IPCA and the fixed spread separately for IPCA_MAIS", () => {
    const result = calculateFixedIncome({
      principalAmount: 10000,
      applicationDate,
      asOfDate: daysAfter(applicationDate, 365),
      type: "TESOURO",
      indexer: "IPCA_MAIS",
      fixedRatePercent: 6,
      ipcaAnnualRate: 4,
    });

    expect(result.grossValue).toBeCloseTo(10000 * 1.04 * 1.06, 0);
  });

  describe("IR regressive bracket", () => {
    const params = { principalAmount: 10000, applicationDate, type: "CDB" as const, indexer: "PREFIXADO" as const, fixedRatePercent: 12 };

    it("applies 22.5% up to 180 days", () => {
      const result = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 180) });
      expect(result.irRate).toBe(22.5);
    });

    it("applies 20% from 181 to 360 days", () => {
      const result = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 181) });
      expect(result.irRate).toBe(20);
      const upper = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 360) });
      expect(upper.irRate).toBe(20);
    });

    it("applies 17.5% from 361 to 720 days", () => {
      const result = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 361) });
      expect(result.irRate).toBe(17.5);
      const upper = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 720) });
      expect(upper.irRate).toBe(17.5);
    });

    it("applies 15% above 720 days", () => {
      const result = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 721) });
      expect(result.irRate).toBe(15);
    });
  });

  describe("IOF regressive table (redemptions under 30 days)", () => {
    const params = { principalAmount: 10000, applicationDate, type: "CDB" as const, indexer: "PREFIXADO" as const, fixedRatePercent: 12 };

    it("retains 96% of the yield as IOF on day 1", () => {
      const result = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 1) });
      expect(result.iofRate).toBe(96);
    });

    it("retains 3% of the yield as IOF on day 29", () => {
      const result = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 29) });
      expect(result.iofRate).toBe(3);
    });

    it("charges no IOF from day 30 onward", () => {
      const result = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 30) });
      expect(result.iofRate).toBe(0);
    });

    it("deducts IOF from the gross yield before applying IR", () => {
      const result = calculateFixedIncome({ ...params, asOfDate: daysAfter(applicationDate, 1) });
      const expectedIofAmount = result.grossYield * 0.96;
      expect(result.iofAmount).toBeCloseTo(expectedIofAmount, 6);
      const yieldAfterIof = result.grossYield - expectedIofAmount;
      expect(result.irAmount).toBeCloseTo(yieldAfterIof * 0.225, 6);
    });
  });

  describe("LCI/LCA IR exemption", () => {
    it("never charges IR on LCI regardless of holding period", () => {
      const result = calculateFixedIncome({
        principalAmount: 10000,
        applicationDate,
        asOfDate: daysAfter(applicationDate, 900),
        type: "LCI",
        indexer: "PREFIXADO",
        fixedRatePercent: 12,
      });
      expect(result.irRate).toBe(0);
      expect(result.irAmount).toBe(0);
    });

    it("never charges IR on LCA regardless of holding period", () => {
      const result = calculateFixedIncome({
        principalAmount: 10000,
        applicationDate,
        asOfDate: daysAfter(applicationDate, 50),
        type: "LCA",
        indexer: "PREFIXADO",
        fixedRatePercent: 12,
      });
      expect(result.irRate).toBe(0);
    });

    it("still charges IR normally on a CDB with the same terms", () => {
      const result = calculateFixedIncome({
        principalAmount: 10000,
        applicationDate,
        asOfDate: daysAfter(applicationDate, 900),
        type: "CDB",
        indexer: "PREFIXADO",
        fixedRatePercent: 12,
      });
      expect(result.irRate).toBe(15);
      expect(result.irAmount).toBeGreaterThan(0);
    });
  });

  it("always yields netValue <= grossValue and netValue = principal + netYield", () => {
    const result = calculateFixedIncome({
      principalAmount: 5000,
      applicationDate,
      asOfDate: daysAfter(applicationDate, 200),
      type: "CDB",
      indexer: "PREFIXADO",
      fixedRatePercent: 15,
    });
    expect(result.netValue).toBeLessThanOrEqual(result.grossValue);
    expect(result.netValue).toBeCloseTo(5000 + result.netYield, 6);
  });

  it("returns zero yield with no growth on the application date itself", () => {
    const result = calculateFixedIncome({
      principalAmount: 5000,
      applicationDate,
      asOfDate: applicationDate,
      type: "CDB",
      indexer: "PREFIXADO",
      fixedRatePercent: 15,
    });
    expect(result.daysElapsed).toBe(0);
    expect(result.grossYield).toBeCloseTo(0, 6);
    expect(result.netValue).toBeCloseTo(5000, 6);
  });
});

describe("principalForTargetNetValue", () => {
  it("scales principal proportionally to the target net value", () => {
    expect(principalForTargetNetValue(1000, 1100, 550)).toBeCloseTo(500, 6);
  });

  it("returns the full principal when the target equals the full net value", () => {
    expect(principalForTargetNetValue(10000, 10092.95, 10092.95)).toBeCloseTo(10000, 6);
  });

  it("returns more than the full principal when the target exceeds what's available (caller must reject)", () => {
    expect(principalForTargetNetValue(1000, 1100, 1200)).toBeGreaterThan(1000);
  });

  it("returns 0 when there's no principal to split", () => {
    expect(principalForTargetNetValue(0, 0, 100)).toBe(0);
  });

  it("matches the real BV 130% CDI case from production: R$2.009,65 desired net out of a R$10.048,27 net position", () => {
    const requiredPrincipal = principalForTargetNetValue(10000, 10048.27, 2009.65);
    expect(requiredPrincipal).toBeCloseTo(2000, 0);
  });
});

describe("splitContribution", () => {
  it("tira o saque do próprio dinheiro aportado: 10.000 aplicados, saca 2.000, sobram 8.000", () => {
    expect(splitContribution(10000, 2000)).toEqual({ withdrawn: 2000, remaining: 8000 });
  });

  it("não deixa o aportado ficar negativo quando o saque passa do que foi aportado", () => {
    // Aportou 1.000, a aplicação já vale 1.300, saca 1.200: 1.000 são a devolução do aporte e os
    // 200 restantes são lucro — o que fica tem aporte zerado, não -200.
    expect(splitContribution(1000, 1200)).toEqual({ withdrawn: 1000, remaining: 0 });
  });

  it("trata saque zero como não mexer em nada", () => {
    expect(splitContribution(10000, 0)).toEqual({ withdrawn: 0, remaining: 10000 });
  });

  it("conserva o total aportado em qualquer divisão", () => {
    for (const saque of [0, 1, 999.99, 5000, 10000, 99999]) {
      const { withdrawn, remaining } = splitContribution(10000, saque);
      expect(withdrawn + remaining).toBeCloseTo(10000, 6);
    }
  });
});

describe("netGain: rendimento medido contra o dinheiro aportado", () => {
  const applicationDate = new Date("2024-01-01T12:00:00Z");
  const base = {
    applicationDate,
    asOfDate: daysAfter(applicationDate, 13),
    type: "CDB" as const,
    indexer: "POS_FIXADO_CDI" as const,
    cdiPercent: 130,
    cdiAnnualRate: 14.9,
  };

  it("sem resgate parcial é idêntico ao netYield — contributedAmount omitido cai no principal", () => {
    const result = calculateFixedIncome({ ...base, principalAmount: 10000 });

    expect(result.contributedAmount).toBe(10000);
    expect(result.netGain).toBeCloseTo(result.netYield, 10);
    expect(result.netGainPercent).toBeCloseTo(result.netProfitabilityPercent, 10);
  });

  /**
   * O caso real que motivou tudo isto: CDB BV 130% do CDI, R$ 10.000 aplicados, saque de R$ 2.000.
   * O principal cai pra ~8.009,76 (proporcional, pra o bruto/líquido continuar fechando), mas o
   * dinheiro aportado que sobrou é R$ 8.000 redondos — e é esse número que aparece no extrato do
   * banco. Antes disso, a tela mostrava "Investido: R$ 8.009,76" e a diferença de ~R$ 10 pro banco
   * era justamente essa.
   */
  it("depois de um resgate parcial, o aportado é o número redondo do banco, não a base de rendimento", () => {
    const cheio = calculateFixedIncome({ ...base, principalAmount: 10000 });
    const principalDaFatia = principalForTargetNetValue(10000, cheio.netValue, 2000);
    const principalRestante = 10000 - principalDaFatia;
    const { remaining: aportadoRestante } = splitContribution(10000, 2000);

    const restante = calculateFixedIncome({ ...base, principalAmount: principalRestante, contributedAmount: aportadoRestante });

    expect(aportadoRestante).toBe(8000);
    expect(restante.contributedAmount).toBe(8000);
    expect(principalRestante).toBeGreaterThan(8000); // a base de rendimento fica acima do aporte
    expect(restante.netGain).toBeCloseTo(restante.netValue - 8000, 6);
    // netYield mede contra a base de rendimento, que já embute o juro rendido antes do saque — por
    // isso reporta um ganho MENOR do que a pessoa de fato tem sobre o dinheiro que pôs. A diferença
    // entre os dois é exatamente o juro que foi absorvido pela base.
    expect(restante.netGain).toBeGreaterThan(restante.netYield);
    expect(restante.netGain - restante.netYield).toBeCloseTo(principalRestante - 8000, 6);
  });

  it("o ganho total não muda por causa da divisão: fatia sacada + restante = ganho da posição inteira", () => {
    const cheio = calculateFixedIncome({ ...base, principalAmount: 10000 });
    const principalDaFatia = principalForTargetNetValue(10000, cheio.netValue, 2000);
    const { withdrawn, remaining } = splitContribution(10000, 2000);

    const fatia = calculateFixedIncome({ ...base, principalAmount: principalDaFatia, contributedAmount: withdrawn });
    const restante = calculateFixedIncome({ ...base, principalAmount: 10000 - principalDaFatia, contributedAmount: remaining });

    // A fatia sacada devolveu exatamente o que se tirou dela: ganho zero, o lucro todo fica com o resto.
    expect(fatia.netValue).toBeCloseTo(2000, 6);
    expect(fatia.netGain).toBeCloseTo(0, 6);
    expect(fatia.netGain + restante.netGain).toBeCloseTo(cheio.netYield, 6);
    expect(fatia.netValue + restante.netValue).toBeCloseTo(cheio.netValue, 6);
  });

  it("não divide por zero quando o aporte inteiro já foi sacado", () => {
    const result = calculateFixedIncome({ ...base, principalAmount: 500, contributedAmount: 0 });
    expect(result.netGainPercent).toBe(0);
    expect(result.netGain).toBeCloseTo(result.netValue, 6);
  });
});

describe("effectiveAnnualRateForCdi", () => {
  it("em 100% do CDI devolve o próprio CDI, sem sobra nem falta", () => {
    expect(effectiveAnnualRateForCdi(14.9, 100)).toBeCloseTo(14.9, 9);
    expect(effectiveAnnualRateForCdi(10, 100)).toBeCloseTo(10, 9);
  });

  /**
   * O erro que fazia o app ficar abaixo do banco: 130% do CDI não é 130% da taxa anual. O
   * percentual incide sobre a taxa DIÁRIA, e é ela que capitaliza ao longo dos 252 dias úteis.
   */
  it("acima de 100% rende mais do que a conta linear sugere", () => {
    const linear = 14.9 * 1.3;
    expect(linear).toBeCloseTo(19.37, 2);
    expect(effectiveAnnualRateForCdi(14.9, 130)).toBeCloseTo(19.787, 2);
    expect(effectiveAnnualRateForCdi(14.9, 130)).toBeGreaterThan(linear);
  });

  it("abaixo de 100% rende menos do que a conta linear sugere", () => {
    expect(effectiveAnnualRateForCdi(14.9, 80)).toBeLessThan(14.9 * 0.8);
  });

  it("não quebra com CDI zerado (indicador indisponível)", () => {
    expect(effectiveAnnualRateForCdi(0, 130)).toBeCloseTo(0, 9);
  });
});

describe("POS_FIXADO_CDI usa a convenção de 252 dias úteis", () => {
  const applicationDate = new Date("2026-01-05T12:00:00Z");

  it("um CDB de 130% do CDI rende acima do que a multiplicação direta daria", () => {
    const params = {
      principalAmount: 8000,
      applicationDate,
      asOfDate: daysAfter(applicationDate, 150),
      type: "CDB" as const,
      indexer: "POS_FIXADO_CDI" as const,
      cdiPercent: 130,
      cdiAnnualRate: 14.9,
    };
    const linear = 8000 * Math.pow(1 + (14.9 * 1.3) / 100, 150 / 365);

    const result = calculateFixedIncome(params);
    expect(result.grossValue).toBeGreaterThan(linear);
    expect(result.grossValue - linear).toBeGreaterThan(10); // ordem de grandeza do que não batia
  });

  it("em 100% do CDI o resultado é o mesmo de antes da correção", () => {
    const result = calculateFixedIncome({
      principalAmount: 8000,
      applicationDate,
      asOfDate: daysAfter(applicationDate, 150),
      type: "CDB",
      indexer: "POS_FIXADO_CDI",
      cdiPercent: 100,
      cdiAnnualRate: 14.9,
    });
    expect(result.grossValue).toBeCloseTo(8000 * Math.pow(1.149, 150 / 365), 6);
  });
});

describe("accrueCdiFactor — série diária oficial", () => {
  // Taxa diária correspondente a um CDI de 14,9% a.a. na base 252.
  const DIARIA = (Math.pow(1.149, 1 / 252) - 1) * 100;

  it("período vazio não rende nada", () => {
    expect(accrueCdiFactor([], 130)).toBe(1);
  });

  it("252 dias úteis a 100% do CDI reproduzem a taxa anual cheia", () => {
    const factor = accrueCdiFactor(Array(252).fill(DIARIA), 100);
    expect((factor - 1) * 100).toBeCloseTo(14.9, 6);
  });

  it("252 dias úteis a 130% batem com a taxa efetiva anual, não com a linear", () => {
    const factor = accrueCdiFactor(Array(252).fill(DIARIA), 130);
    expect((factor - 1) * 100).toBeCloseTo(effectiveAnnualRateForCdi(14.9, 130), 6);
    expect((factor - 1) * 100).toBeGreaterThan(14.9 * 1.3);
  });

  /** O ponto de ter a série: uma mudança de taxa no meio do caminho vale só dali pra frente. */
  it("cada dia usa a taxa que valia naquele dia, sem reescrever o passado", () => {
    const baixa = Array(50).fill(0.04);
    const alta = Array(50).fill(0.06);
    const misto = accrueCdiFactor([...baixa, ...alta], 100);
    const soAlta = accrueCdiFactor(Array(100).fill(0.06), 100);
    const soBaixa = accrueCdiFactor(Array(100).fill(0.04), 100);

    expect(misto).toBeLessThan(soAlta);
    expect(misto).toBeGreaterThan(soBaixa);
    // E a ordem dos dias não muda o total — multiplicação é comutativa, como no banco.
    expect(accrueCdiFactor([...alta, ...baixa], 100)).toBeCloseTo(misto, 12);
  });

  it("um dia de CDI zero não mexe no acumulado", () => {
    expect(accrueCdiFactor([0.05, 0, 0.05], 100)).toBeCloseTo(accrueCdiFactor([0.05, 0.05], 100), 12);
  });
});

describe("calculateFixedIncome com o fator da série diária", () => {
  const applicationDate = new Date("2026-01-05T12:00:00Z");
  const base = {
    principalAmount: 8000,
    applicationDate,
    asOfDate: daysAfter(applicationDate, 150),
    type: "CDB" as const,
    indexer: "POS_FIXADO_CDI" as const,
    cdiPercent: 130,
    cdiAnnualRate: 14.9,
  };

  it("quando o fator existe, é ele que manda — a taxa anual é ignorada", () => {
    const comFator = calculateFixedIncome({ ...base, cdiAccrualFactor: 1.02 });
    expect(comFator.grossValue).toBeCloseTo(8160, 6);

    // Uma cdiAnnualRate absurda não pode mudar nada se o fator veio da série.
    const outraTaxa = calculateFixedIncome({ ...base, cdiAnnualRate: 99, cdiAccrualFactor: 1.02 });
    expect(outraTaxa.grossValue).toBeCloseTo(comFator.grossValue, 9);
  });

  it("sem o fator, cai na taxa anual — o resultado continua saindo, só menos exato", () => {
    const semFator = calculateFixedIncome(base);
    expect(semFator.grossValue).toBeGreaterThan(8000);
  });

  it("IR e IOF incidem igual, venha o rendimento de onde vier", () => {
    const result = calculateFixedIncome({ ...base, asOfDate: daysAfter(applicationDate, 10), cdiAccrualFactor: 1.005 });
    expect(result.grossYield).toBeCloseTo(40, 6);
    expect(result.iofRate).toBe(66); // 10 dias
    expect(result.irRate).toBe(22.5);
    expect(result.netValue).toBeCloseTo(8000 + result.netYield, 9);
  });
});

describe("nextBusinessDay / businessDaysBetween", () => {
  const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  it("de sexta pula pra segunda", () => {
    expect(nextBusinessDay(d("2026-08-07"))).toEqual(d("2026-08-10"));
  });

  it("de sábado e de domingo também caem na segunda", () => {
    expect(nextBusinessDay(d("2026-08-08"))).toEqual(d("2026-08-10"));
    expect(nextBusinessDay(d("2026-08-09"))).toEqual(d("2026-08-10"));
  });

  it("num dia útil comum é o dia seguinte", () => {
    expect(nextBusinessDay(d("2026-08-10"))).toEqual(d("2026-08-11"));
  });

  it("ignora a hora — o resultado é sempre meia-noite UTC", () => {
    expect(nextBusinessDay(new Date("2026-08-09T23:47:03.123Z"))).toEqual(d("2026-08-10"));
  });

  it("conta dias úteis com as duas pontas incluídas", () => {
    expect(businessDaysBetween(d("2026-08-10"), d("2026-08-10"))).toBe(1);
    expect(businessDaysBetween(d("2026-08-07"), d("2026-08-10"))).toBe(2); // sex + seg
    expect(businessDaysBetween(d("2026-07-14"), d("2026-08-07"))).toBe(19);
  });

  it("intervalo invertido ou só de fim de semana dá zero", () => {
    expect(businessDaysBetween(d("2026-08-10"), d("2026-08-07"))).toBe(0);
    expect(businessDaysBetween(d("2026-08-08"), d("2026-08-09"))).toBe(0);
  });
});

/**
 * O caso real que fechou a conferência: CDB BV a 130% do CDI, aplicado em 14/07/2026, com resgate
 * parcial em 03/08. Em 09/08 (domingo) o extrato do banco mostrava a posição avaliada na
 * liquidação — segunda, 10/08 — com 19 dias úteis de CDI e IOF na faixa de 27 dias.
 */
describe("avaliação na data de liquidação — números reais do extrato", () => {
  const aplicacao = new Date("2026-07-14T00:00:00.000Z");
  const liquidacao = nextBusinessDay(new Date("2026-08-09T12:00:00.000Z"));
  const cdiDiario = (Math.pow(1.1409, 1 / 252) - 1) * 100;

  it("liquidando num domingo, a data de referência é a segunda seguinte", () => {
    expect(liquidacao).toEqual(new Date("2026-08-10T00:00:00.000Z"));
  });

  it("reproduz o bruto e o líquido do extrato dentro de centavos", () => {
    const diasUteis = businessDaysBetween(aplicacao, new Date("2026-08-07T00:00:00.000Z"));
    expect(diasUteis).toBe(19);

    const result = calculateFixedIncome({
      principalAmount: 8009.93,
      applicationDate: aplicacao,
      asOfDate: liquidacao,
      type: "CDB",
      indexer: "POS_FIXADO_CDI",
      cdiPercent: 130,
      cdiAnnualRate: 14.09,
      cdiAccrualFactor: accrueCdiFactor(Array(diasUteis).fill(cdiDiario), 130),
    });

    expect(result.daysElapsed).toBe(27);
    expect(result.iofRate).toBe(10); // o banco cobrou 9,99% do rendimento
    expect(result.irRate).toBe(22.5);

    // A tolerância é de R$ 0,50 e não de centavos porque aqui o CDI é achatado em 14,09% pros 19
    // dias, enquanto a série real oscilou um pouco no período — em produção quem entra é a série
    // dia a dia. O que este teste trava é a ordem de grandeza e, principalmente, o dia de
    // referência: com a data errada a diferença passa de R$ 5, como o teste seguinte mostra.
    expect(Math.abs(result.grossValue - 8114.31)).toBeLessThan(0.5); // extrato: 8.114,31
    expect(Math.abs(result.netValue - 8082.74)).toBeLessThan(0.5); // extrato: 8.082,74
  });

  it("avaliando em 09/08 em vez da liquidação, dá os R$ 6 a menos que o usuário via", () => {
    const diasUteis = businessDaysBetween(aplicacao, new Date("2026-08-06T00:00:00.000Z"));
    const atrasado = calculateFixedIncome({
      principalAmount: 8009.93,
      applicationDate: aplicacao,
      asOfDate: new Date("2026-08-09T12:00:00.000Z"),
      type: "CDB",
      indexer: "POS_FIXADO_CDI",
      cdiPercent: 130,
      cdiAnnualRate: 14.09,
      cdiAccrualFactor: accrueCdiFactor(Array(diasUteis).fill(cdiDiario), 130),
    });

    expect(atrasado.daysElapsed).toBe(26);
    expect(atrasado.iofRate).toBe(13); // a faixa errada, um dia atrás
    expect(8082.74 - atrasado.netValue).toBeGreaterThan(5);
  });
});
