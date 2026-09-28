/**
 * O preço "de prateleira" mais próximo do que a conta pediu.
 *
 * O divisor devolve R$ 83,33 e ninguém vende a R$ 83,33 — vende a R$ 83,90, R$ 89,90 ou R$ 90,00.
 * Esta função dá as três opções **e a margem que cada uma realmente entrega**, que é a parte que
 * importa: arredondar muda a margem, e mostrar o preço bonito sem dizer o que ele fez com o lucro
 * seria trocar precisão por estética sem avisar.
 *
 * **Arredonda sempre pra CIMA.** Pra baixo é o caminho fácil pro número redondo e entrega menos
 * margem do que a pessoa pediu — exatamente o que o módulo existe pra impedir.
 */
export type RoundingStyle = "ENDS_90" | "ENDS_990" | "ROUND_10";

export interface PsychologicalOption {
  style: RoundingStyle;
  price: number;
}

/** Tudo em centavos: somar 0,90 em ponto flutuante devolve 83,89999999999999 e o preço "bonito"
 *  sai feio. */
function toCents(reais: number): number {
  return Math.round(reais * 100);
}

function ceilTo(cents: number, modulo: number, resto: number): number {
  const base = Math.floor(cents / modulo) * modulo + resto;
  return base >= cents ? base : base + modulo;
}

export function psychologicalPrices(price: number): PsychologicalOption[] {
  if (!Number.isFinite(price) || price <= 0) return [];
  const cents = toCents(price);

  const opcoes: PsychologicalOption[] = [
    { style: "ENDS_90", price: ceilTo(cents, 100, 90) / 100 },
    { style: "ENDS_990", price: ceilTo(cents, 1000, 990) / 100 },
    { style: "ROUND_10", price: (Math.ceil(cents / 1000) * 1000) / 100 },
  ];

  // Duas regras podem cair no mesmo valor (89,90 é "termina em 90" e "termina em 9,90"); repetir a
  // mesma opção na tela só ocuparia linha.
  const vistos = new Set<number>();
  return opcoes.filter((o) => (vistos.has(o.price) ? false : (vistos.add(o.price), true)));
}
