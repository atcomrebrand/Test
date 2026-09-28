import { addMonthsClamped, computeNextDueDate, computeTenure, fullMonthsBetween } from "./tenure";

const em = (iso: string) => new Date(iso);

describe("addMonthsClamped", () => {
  it("preserva o dia do mês", () => {
    expect(addMonthsClamped(em("2026-03-12"), 1).toISOString().slice(0, 10)).toBe("2026-04-12");
  });

  it("clampa no último dia quando o mês de destino é mais curto", () => {
    // Sem clamp isso viraria 03/03 e a assinatura mudaria de dia de cobrança pra sempre.
    expect(addMonthsClamped(em("2026-01-31"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(addMonthsClamped(em("2024-01-31"), 1).toISOString().slice(0, 10)).toBe("2024-02-29");
    expect(addMonthsClamped(em("2026-05-31"), 1).toISOString().slice(0, 10)).toBe("2026-06-30");
  });

  it("atravessa o ano", () => {
    expect(addMonthsClamped(em("2026-12-15"), 1).toISOString().slice(0, 10)).toBe("2027-01-15");
    expect(addMonthsClamped(em("2026-08-11"), 12).toISOString().slice(0, 10)).toBe("2027-08-11");
  });
});

describe("computeNextDueDate", () => {
  const hoje = em("2026-08-11");

  it("ancora no vencimento atual, não em hoje", () => {
    // Renovar no dia 8 um plano que vence dia 12 tem que manter o dia 12.
    const next = computeNextDueDate({ currentDueDate: em("2026-08-12"), period: "MONTHLY", today: em("2026-08-08") });
    expect(next.toISOString().slice(0, 10)).toBe("2026-09-12");
  });

  it("respeita cada período", () => {
    const base = { currentDueDate: em("2026-08-11"), today: hoje } as const;
    expect(computeNextDueDate({ ...base, period: "BIMONTHLY" }).toISOString().slice(0, 10)).toBe("2026-10-11");
    expect(computeNextDueDate({ ...base, period: "QUARTERLY" }).toISOString().slice(0, 10)).toBe("2026-11-11");
    expect(computeNextDueDate({ ...base, period: "SEMIANNUAL" }).toISOString().slice(0, 10)).toBe("2027-02-11");
    expect(computeNextDueDate({ ...base, period: "ANNUAL" }).toISOString().slice(0, 10)).toBe("2027-08-11");
  });

  it("usa customDays quando o período é CUSTOM, com 30 como padrão", () => {
    expect(
      computeNextDueDate({ currentDueDate: em("2026-08-11"), period: "CUSTOM", customDays: 15, today: hoje })
        .toISOString()
        .slice(0, 10),
    ).toBe("2026-08-26");
    expect(
      computeNextDueDate({ currentDueDate: em("2026-08-11"), period: "CUSTOM", customDays: null, today: hoje })
        .toISOString()
        .slice(0, 10),
    ).toBe("2026-09-10");
  });

  it("reancora em hoje quando o vencimento antigo é velho demais", () => {
    // Cliente sumiu em março e voltou agora: somar 1 mês ao vencimento antigo daria 01/04, ou seja,
    // ele pagaria e continuaria inadimplente na mesma hora.
    const next = computeNextDueDate({ currentDueDate: em("2026-03-01"), period: "MONTHLY", today: hoje });
    expect(next.toISOString().slice(0, 10)).toBe("2026-09-11");
  });

  it("não reancora quando o resultado ainda é hoje", () => {
    // Fronteira: cair exatamente em hoje conta como válido, não como atrasado.
    const next = computeNextDueDate({ currentDueDate: em("2026-07-11"), period: "MONTHLY", today: hoje });
    expect(next.toISOString().slice(0, 10)).toBe("2026-08-11");
  });
});

describe("fullMonthsBetween", () => {
  it("só conta o mês depois que o dia fecha", () => {
    expect(fullMonthsBetween(em("2026-01-11"), em("2026-02-10"))).toBe(0);
    expect(fullMonthsBetween(em("2026-01-11"), em("2026-02-11"))).toBe(1);
  });

  it("fecha o mês quando o dia de origem não existe no mês de destino", () => {
    // Assinou 31/01: em 28/02 o mês fechou. Descontar aqui deixaria "0 meses" todo fevereiro.
    expect(fullMonthsBetween(em("2026-01-31"), em("2026-02-28"))).toBe(1);
  });

  it("nunca é negativo", () => {
    expect(fullMonthsBetween(em("2026-08-11"), em("2026-01-01"))).toBe(0);
  });
});

describe("computeTenure", () => {
  const hoje = em("2026-08-11");

  it("devolve null sem data de início", () => {
    expect(computeTenure(null, hoje)).toBeNull();
  });

  it("rotula anos e meses juntos", () => {
    const t = computeTenure(em("2024-04-11"), hoje);
    expect(t).toMatchObject({ years: 2, remainingMonths: 4, months: 28 });
    expect(t!.label).toBe("2 anos e 4 meses");
  });

  it("omite os meses quando são zero", () => {
    expect(computeTenure(em("2025-08-11"), hoje)!.label).toBe("1 ano");
  });

  it("usa meses quando ainda não fez um ano, e dias no primeiro mês", () => {
    expect(computeTenure(em("2026-06-11"), hoje)!.label).toBe("2 meses");
    expect(computeTenure(em("2026-07-11"), hoje)!.label).toBe("1 mês");
    // 15/07 ainda não fechou um mês em 11/08 — o dia 15 não chegou em agosto, então são dias.
    expect(computeTenure(em("2026-07-15"), hoje)!.label).toBe("27 dias");
    expect(computeTenure(em("2026-08-10"), hoje)!.label).toBe("1 dia");
    expect(computeTenure(em("2026-08-11"), hoje)!.label).toBe("0 dias");
  });

  it("conta os dias corridos junto com os meses", () => {
    expect(computeTenure(em("2024-04-11"), hoje)!.days).toBe(852);
  });
});
