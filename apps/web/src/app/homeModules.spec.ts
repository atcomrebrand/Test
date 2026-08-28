import { describe, expect, it } from "vitest";
import { orderModules } from "./homeModules";

const MODULOS = [{ to: "/parcelas" }, { to: "/investimentos" }, { to: "/casa" }, { to: "/academia" }];
const rotas = (m: { to: string }[]) => m.map((x) => x.to);

describe("orderModules", () => {
  it("sem preferência devolve a ordem do código", () => {
    expect(rotas(orderModules(MODULOS, []))).toEqual(["/parcelas", "/investimentos", "/casa", "/academia"]);
    expect(rotas(orderModules(MODULOS, undefined))).toEqual(["/parcelas", "/investimentos", "/casa", "/academia"]);
  });

  it("aplica a ordem escolhida", () => {
    expect(rotas(orderModules(MODULOS, ["/academia", "/casa", "/parcelas", "/investimentos"]))).toEqual([
      "/academia", "/casa", "/parcelas", "/investimentos",
    ]);
  });

  it("MÓDULO NOVO aparece no fim em vez de sumir", () => {
    // A preferência foi salva antes da Academia existir. Ela não podia estar na lista.
    expect(rotas(orderModules(MODULOS, ["/casa", "/parcelas", "/investimentos"]))).toEqual([
      "/casa", "/parcelas", "/investimentos", "/academia",
    ]);
  });

  it("mais de um módulo novo mantém entre eles a ordem do código", () => {
    expect(rotas(orderModules(MODULOS, ["/academia"]))).toEqual([
      "/academia", "/parcelas", "/investimentos", "/casa",
    ]);
  });

  it("rota de módulo que não existe mais é ignorada, sem deixar buraco", () => {
    expect(rotas(orderModules(MODULOS, ["/academia", "/modulo-extinto", "/casa"]))).toEqual([
      "/academia", "/casa", "/parcelas", "/investimentos",
    ]);
  });

  it("rota repetida na preferência não duplica o card", () => {
    expect(rotas(orderModules(MODULOS, ["/casa", "/casa", "/parcelas"]))).toEqual([
      "/casa", "/parcelas", "/investimentos", "/academia",
    ]);
  });

  it("nunca perde nem inventa módulo", () => {
    for (const pref of [[], ["/academia"], ["/x"], ["/casa", "/academia", "/parcelas", "/investimentos"]]) {
      expect(orderModules(MODULOS, pref)).toHaveLength(MODULOS.length);
    }
  });
});
