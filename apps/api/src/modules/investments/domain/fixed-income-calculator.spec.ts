import { calculateFixedIncome, principalForTargetNetValue, splitContribution } from "./fixed-income-calculator";

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

  it("applies POS_FIXADO_CDI using cdiPercent of the current CDI annual rate", () => {
    const result = calculateFixedIncome({
      principalAmount: 10000,
      applicationDate,
      asOfDate: daysAfter(applicationDate, 365),
      type: "CDB",
      indexer: "POS_FIXADO_CDI",
      cdiPercent: 110,
      cdiAnnualRate: 10,
    });

    // effective annual = 10 * 1.10 = 11%
    expect(result.grossValue).toBeCloseTo(11100, 0);
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
