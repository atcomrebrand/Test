import { psychologicalPrices } from "./psychological-price";

const precos = (v: number) => psychologicalPrices(v).map((o) => o.price);

describe("psychologicalPrices", () => {
  it("R$ 83,33 vira 83,90 / 89,90 / 90,00", () => {
    // O divisor devolve 83,33 e ninguém vende assim.
    expect(precos(83.33)).toEqual([83.9, 89.9, 90]);
  });

  it("arredonda sempre pra CIMA — nunca entrega menos margem que a pedida", () => {
    // 83,29 pra baixo daria 82,90 e a margem cairia abaixo do que a pessoa pediu.
    expect(psychologicalPrices(83.29).every((o) => o.price >= 83.29)).toBe(true);
    expect(psychologicalPrices(89.95).every((o) => o.price >= 89.95)).toBe(true);
    expect(psychologicalPrices(0.05).every((o) => o.price >= 0.05)).toBe(true);
  });

  it("preço já terminado em ,90 não é empurrado pra frente", () => {
    // 89,90 satisfaz as DUAS regras de ,90 ao mesmo tempo, então elas colapsam numa opção só —
    // não existe "próximo 9,90" pra quem já está nele.
    expect(precos(89.9)).toEqual([89.9, 90]);
  });

  it("logo acima do ,90 pula pro próximo", () => {
    expect(precos(89.95)).toEqual([90.9, 99.9, 90]);
  });

  it("não repete a mesma opção quando duas regras coincidem", () => {
    // 89,90 é "termina em 90" e "termina em 9,90" ao mesmo tempo.
    const r = psychologicalPrices(85);
    expect(r.map((o) => o.price)).toEqual([85.9, 89.9, 90]);
    expect(new Set(r.map((o) => o.price)).size).toBe(r.length);
  });

  it("funciona em valores altos", () => {
    expect(precos(1234.56)).toEqual([1234.9, 1239.9, 1240]);
  });

  it("não sofre com ponto flutuante", () => {
    // Somar 0,90 em float devolve 83,89999999999999 e o preço bonito sai feio.
    for (const { price } of psychologicalPrices(83.33)) {
      expect(String(price)).not.toMatch(/\.\d{3,}/);
    }
  });

  it("preço zero ou inválido devolve lista vazia, não um preço inventado", () => {
    expect(psychologicalPrices(0)).toEqual([]);
    expect(psychologicalPrices(-5)).toEqual([]);
    expect(psychologicalPrices(NaN)).toEqual([]);
  });
});
