import { computeCustomerStatus, diffInDays, isActiveStatus } from "./customer-status";

const hoje = new Date("2026-08-11T12:00:00Z");
const em = (iso: string) => new Date(iso);

describe("diffInDays", () => {
  it("compara calendário, não instantes", () => {
    // O mesmo dia com horas diferentes é distância zero — se comparasse timestamps daria 0.75 dia
    // e o Math.floor comeria um dia inteiro na faixa de vencimento.
    expect(diffInDays(em("2026-08-11T23:00:00Z"), em("2026-08-11T02:00:00Z"))).toBe(0);
    expect(diffInDays(em("2026-08-11T23:00:00Z"), em("2026-08-12T02:00:00Z"))).toBe(1);
  });

  it("conta negativo pra trás", () => {
    expect(diffInDays(hoje, em("2026-08-08T00:00:00Z"))).toBe(-3);
  });
});

describe("computeCustomerStatus", () => {
  it("é ACTIVE quando falta bastante pro vencimento", () => {
    const r = computeCustomerStatus({ currentDueDate: em("2026-09-11"), today: hoje });
    expect(r.status).toBe("ACTIVE");
    expect(r.daysUntilDue).toBe(31);
    expect(r.daysLate).toBe(0);
  });

  it("é DUE_SOON dentro da janela de 3 dias, incluindo o próprio dia do vencimento", () => {
    expect(computeCustomerStatus({ currentDueDate: em("2026-08-14"), today: hoje }).status).toBe("DUE_SOON");
    expect(computeCustomerStatus({ currentDueDate: em("2026-08-11"), today: hoje }).status).toBe("DUE_SOON");
    // Um dia além da janela ainda é ACTIVE — a fronteira precisa estar travada dos dois lados.
    expect(computeCustomerStatus({ currentDueDate: em("2026-08-15"), today: hoje }).status).toBe("ACTIVE");
  });

  it("vira LATE no dia seguinte ao vencimento e DELINQUENT depois de 7 dias", () => {
    expect(computeCustomerStatus({ currentDueDate: em("2026-08-10"), today: hoje }).status).toBe("LATE");
    expect(computeCustomerStatus({ currentDueDate: em("2026-08-04"), today: hoje }).status).toBe("LATE");
    expect(computeCustomerStatus({ currentDueDate: em("2026-08-03"), today: hoje }).status).toBe("DELINQUENT");
  });

  it("reporta daysLate positivo, pra UI não precisar inverter sinal", () => {
    const r = computeCustomerStatus({ currentDueDate: em("2026-08-06"), today: hoje });
    expect(r.daysUntilDue).toBe(-5);
    expect(r.daysLate).toBe(5);
  });

  it("respeita o cancelamento mesmo com vencimento no futuro", () => {
    // Cancelar quem pagou até o fim do mês é o caso normal; o cálculo não pode descancelar.
    const r = computeCustomerStatus({
      currentDueDate: em("2026-09-11"),
      manualStatus: "CANCELLED",
      today: hoje,
    });
    expect(r.status).toBe("CANCELLED");
    expect(r.daysUntilDue).toBe(31);
  });

  it("ignora um manualStatus que não é dos manuais", () => {
    // ACTIVE gravado no banco não pode congelar o cliente como ativo pra sempre.
    const r = computeCustomerStatus({
      currentDueDate: em("2026-08-01"),
      manualStatus: "ACTIVE",
      today: hoje,
    });
    expect(r.status).toBe("DELINQUENT");
  });

  it("teste em andamento vence o vencimento, mas não vence o cancelamento", () => {
    expect(
      computeCustomerStatus({ currentDueDate: em("2026-08-01"), trialEndsAt: em("2026-08-20"), today: hoje }).status,
    ).toBe("TRIAL");
    expect(
      computeCustomerStatus({
        currentDueDate: em("2026-08-01"),
        trialEndsAt: em("2026-08-20"),
        manualStatus: "CANCELLED",
        today: hoje,
      }).status,
    ).toBe("CANCELLED");
  });

  it("teste que terminou ontem já cai na regra de vencimento", () => {
    const r = computeCustomerStatus({
      currentDueDate: em("2026-08-01"),
      trialEndsAt: em("2026-08-10"),
      today: hoje,
    });
    expect(r.status).toBe("DELINQUENT");
  });

  it("sem vencimento é LEAD quando nunca assinou e INACTIVE quando já assinou", () => {
    expect(computeCustomerStatus({ currentDueDate: null, today: hoje }).status).toBe("LEAD");
    expect(computeCustomerStatus({ currentDueDate: null, hasEverSubscribed: true, today: hoje }).status).toBe(
      "INACTIVE",
    );
  });
});

describe("isActiveStatus", () => {
  it("conta vencendo e teste como ativo, atraso não", () => {
    expect(isActiveStatus("ACTIVE")).toBe(true);
    expect(isActiveStatus("DUE_SOON")).toBe(true);
    expect(isActiveStatus("TRIAL")).toBe(true);
    expect(isActiveStatus("LATE")).toBe(false);
    expect(isActiveStatus("CANCELLED")).toBe(false);
  });
});
