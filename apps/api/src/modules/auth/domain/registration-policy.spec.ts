import { decideRegistration } from "./registration-policy";

describe("decideRegistration", () => {
  it("instalação nova consegue criar a primeira conta sem configurar nada", () => {
    expect(decideRegistration(undefined, 0).open).toBe(true);
  });

  it("e se fecha sozinha assim que existe alguém — é o caso de produção hoje", () => {
    expect(decideRegistration(undefined, 1).open).toBe(false);
    expect(decideRegistration(undefined, 5).open).toBe(false);
  });

  it("a flag liga o cadastro mesmo com contas existentes (desenvolvimento)", () => {
    expect(decideRegistration("true", 3).open).toBe(true);
    expect(decideRegistration("1", 3).open).toBe(true);
  });

  it("a flag desliga mesmo sem nenhuma conta — travar de propósito é uma escolha válida", () => {
    expect(decideRegistration("false", 0).open).toBe(false);
    expect(decideRegistration("0", 0).open).toBe(false);
  });

  it("aceita a flag com espaço e maiúscula, que é como ela costuma chegar de .env", () => {
    expect(decideRegistration(" TRUE ", 2).open).toBe(true);
    expect(decideRegistration("False", 0).open).toBe(false);
  });

  it("valor sem sentido não é lido como liberado — na dúvida, fechado", () => {
    expect(decideRegistration("talvez", 1).open).toBe(false);
    expect(decideRegistration("", 1).open).toBe(false);
  });

  it("sempre explica o porquê: 'fechado' sem motivo vira suporte", () => {
    expect(decideRegistration(undefined, 1).reason).toMatch(/desativado/i);
    expect(decideRegistration(undefined, 0).reason).toMatch(/primeira conta/i);
  });
});
