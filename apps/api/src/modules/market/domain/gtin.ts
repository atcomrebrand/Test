/**
 * O código de barras do produto, quando a nota traz um.
 *
 * A NFC-e imprime "Código:" com o `cProd`, que é **o código interno do mercado** — e por isso não
 * servia pra agrupar nada entre lojas. Só que boa parte do varejo usa o próprio código de barras
 * como código interno: numa nota real de 2026-08 (Shibata, Pindamonhangaba), os quatro produtos
 * embalados vieram com EAN-13 (`7896002304184` pro pão brioche) e os três de balança com código
 * curto da loja (`6339`, `5707`, `354`).
 *
 * Quando é EAN, é ouro: o mesmo produto tem o mesmo número em qualquer mercado do país, o que
 * resolve de forma **exata** o problema que a comparação de nomes só consegue adivinhar.
 */

/** Comprimentos válidos de GTIN: EAN-8, UPC-A, EAN-13 e DUN-14. */
const COMPRIMENTOS = new Set([8, 12, 13, 14]);

/**
 * Dígito verificador GS1: soma dos dígitos com peso 3 e 1 alternados a partir da direita, e o que
 * falta pra fechar a dezena é o último dígito.
 *
 * É ele que separa um código de barras de verdade de um código interno que por acaso tem 13
 * dígitos — sem essa checagem, a numeração própria de um mercado viraria "identidade global" e
 * juntaria produtos que não têm nada a ver.
 */
function digitoConfere(digitos: string): boolean {
  const numeros = [...digitos].map(Number);
  const dv = numeros[numeros.length - 1];
  const corpo = numeros.slice(0, -1).reverse();

  let soma = 0;
  for (let i = 0; i < corpo.length; i++) soma += corpo[i] * (i % 2 === 0 ? 3 : 1);

  return (10 - (soma % 10)) % 10 === dv;
}

/**
 * Devolve o GTIN normalizado, ou `null` quando o código não é um.
 *
 * `null` não é falha: item de balança e mercado que numera do seu jeito simplesmente não têm código
 * global, e continuam agrupados pela chave normalizada do nome como sempre foram.
 *
 * A normalização pra 14 dígitos com zeros à esquerda existe porque o mesmo produto pode aparecer
 * como UPC-A de 12 num lugar e EAN-13 de 13 em outro — são a mesma numeração com um zero na frente,
 * e compará-las como texto cru não casaria.
 */
export function parseGtin(code: string | null | undefined): string | null {
  if (!code) return null;

  const digitos = code.replace(/\D/g, "");
  if (!COMPRIMENTOS.has(digitos.length)) return null;
  // Código todo zero passa no dígito verificador e não identifica nada — "sem GTIN" costuma ser
  // gravado assim.
  if (/^0+$/.test(digitos)) return null;
  if (!digitoConfere(digitos)) return null;

  return digitos.padStart(14, "0");
}
