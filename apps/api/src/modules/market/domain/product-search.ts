export interface SearchableProduct {
  id: string;
  name: string;
}

/** Sem acento, sem caixa, sem pontuação — "café" tem que achar "CAFE PILAO 500G". */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Acha os produtos que casam com o que a pessoa digitou.
 *
 * A busca é por todas as palavras do termo, em qualquer ordem, e não pela frase inteira: o produto
 * é gravado com o nome que o mercado imprimiu na nota ("CAFE PILAO 500G"), e ninguém pergunta assim
 * — pergunta "café pilão", "pilão", "o café". Exigir a frase literal faria a busca falhar
 * justamente nas formas que as pessoas usam.
 *
 * Devolve ordenado por quão perto o nome está do termo (nome mais curto primeiro entre os que
 * casam), porque "CAFE PILAO 500G" é resposta melhor pra "café" do que "BOMBOM CAFE TRUFADO 90G".
 */
export function searchProducts<T extends SearchableProduct>(products: T[], term: string, limit = 5): T[] {
  const palavras = normalize(term).split(" ").filter(Boolean);
  if (palavras.length === 0) return [];

  return products
    .map((product) => ({ product, nome: normalize(product.name) }))
    .filter(({ nome }) => palavras.every((palavra) => nome.includes(palavra)))
    .sort((a, b) => a.nome.length - b.nome.length || a.nome.localeCompare(b.nome))
    .slice(0, limit)
    .map(({ product }) => product);
}
