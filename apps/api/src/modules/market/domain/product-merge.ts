/**
 * Unir produtos que são o mesmo item com nomes diferentes em cada mercado.
 *
 * A chave normalizada (market-product-key.ts) resolve grafia: abreviação, acento, "5 KG" vs "5KG".
 * O que ela não resolve — e nem tem como — é quando os mercados escolhem **palavras diferentes**
 * pro mesmo produto: "PAO BRIOCHE 520G" num, "PAO DE LEITE BRIOCHE WICKBOLD 520G" no outro. Aí não
 * existe normalização, existe decisão.
 *
 * Por isso aqui só se **sugere**, nunca se une sozinho. Vale a mesma regra do resto do módulo:
 * separar um produto em dois é um incômodo visível e corrigível; juntar dois produtos diferentes
 * estraga o histórico de preço de um jeito que ninguém percebe depois.
 */

/** Token de embalagem: "520G", "1L", "5KG". Sai da comparação de palavras e vira critério próprio. */
const TOKEN_TAMANHO = /^\d+(?:KG|G|L|ML|UN|PACOTE|CAIXA)$|^\d+$/;

export interface MergeCandidate {
  id: string;
  name: string;
  /** Saída de marketProductKey(). */
  normalizedKey: string;
}

export interface MergeSuggestion {
  ids: [string, string];
  names: [string, string];
  /** 0..1 — quanto das palavras do nome mais curto aparece também no outro. */
  score: number;
  /** As palavras que os dois têm em comum, pra tela poder mostrar o porquê da sugestão. */
  shared: string[];
}

/** Abaixo disso não é parecido o bastante pra valer o incômodo de perguntar. */
const SCORE_MINIMO = 0.6;

/**
 * Duas palavras iguais, no mínimo.
 *
 * "PAO FRANCES" e "PAO BRIOCHE" dividem "PAO" e não são a mesma coisa. Uma palavra genérica em
 * comum é o tipo de evidência que gera uma lista de sugestões que ninguém lê.
 */
const MINIMO_DE_PALAVRAS_EM_COMUM = 2;

function separar(normalizedKey: string): { palavras: string[]; tamanhos: string[] } {
  const palavras: string[] = [];
  const tamanhos: string[] = [];
  for (const token of normalizedKey.split(" ").filter((t) => t !== "")) {
    if (TOKEN_TAMANHO.test(token)) tamanhos.push(token);
    else palavras.push(token);
  }
  return { palavras: [...new Set(palavras)], tamanhos: [...new Set(tamanhos)] };
}

/**
 * Pares que valem a pena perguntar "é o mesmo produto?".
 *
 * Duas regras carregam quase tudo:
 *
 * 1. **Embalagem diferente derruba o par na hora.** "PAO BRIOCHE 520G" e "PAO BRIOCHE 300G" têm as
 *    mesmas palavras e não são o mesmo produto — juntar os dois faria o histórico comparar preço de
 *    embalagens diferentes, que é pior do que não ter histórico. Quando só um dos lados declara
 *    tamanho não há conflito, então o par continua.
 * 2. **A pontuação é por continência, não por igualdade**: mede quanto do nome *mais curto* aparece
 *    no outro. É o que permite o mercado que escreve a marca inteira casar com o que escreve só o
 *    essencial — que é justamente o caso que motivou isso tudo.
 */
export function suggestProductMerges(products: MergeCandidate[], minScore = SCORE_MINIMO): MergeSuggestion[] {
  const preparados = products.map((p) => ({ ...p, ...separar(p.normalizedKey) }));
  const sugestoes: MergeSuggestion[] = [];

  for (let i = 0; i < preparados.length; i++) {
    for (let j = i + 1; j < preparados.length; j++) {
      const a = preparados[i];
      const b = preparados[j];

      if (a.tamanhos.length > 0 && b.tamanhos.length > 0 && !a.tamanhos.some((t) => b.tamanhos.includes(t))) continue;

      const shared = a.palavras.filter((palavra) => b.palavras.includes(palavra));
      if (shared.length < MINIMO_DE_PALAVRAS_EM_COMUM) continue;

      const menor = Math.min(a.palavras.length, b.palavras.length);
      if (menor === 0) continue;

      const score = shared.length / menor;
      if (score < minScore) continue;

      sugestoes.push({ ids: [a.id, b.id], names: [a.name, b.name], score, shared });
    }
  }

  // Mais parecido primeiro: é a ordem em que as decisões são mais fáceis de tomar.
  return sugestoes.sort((x, y) => y.score - x.score || x.names[0].localeCompare(y.names[0], "pt-BR"));
}

/**
 * O produto que de fato carrega o histórico.
 *
 * Uma união é um ponteiro (`canonicalId`), não uma exclusão — o produto absorvido continua no banco
 * com o nome que o mercado deu, e desfazer é limpar o campo. O preço disso é que o ponteiro pode
 * apontar pra alguém que também foi unido depois, então a resolução segue a corrente.
 *
 * O teto de saltos existe pra um ciclo (A→B→A, que só apareceria por dado corrompido ou corrida)
 * não travar a listagem de produtos num laço infinito.
 */
export function resolveCanonicalId(id: string, canonicalById: Map<string, string | null>, maxSaltos = 10): string {
  let atual = id;
  for (let i = 0; i < maxSaltos; i++) {
    const proximo = canonicalById.get(atual);
    if (!proximo || proximo === atual) return atual;
    atual = proximo;
  }
  return atual;
}

/**
 * Agrupa os produtos pelo canônico de cada um. O canônico sempre entra no próprio grupo, e um
 * produto que ninguém uniu forma um grupo de um — assim quem chama trata os dois casos igual.
 */
export function groupByCanonical<T extends { id: string; canonicalId: string | null }>(products: T[]): Map<string, T[]> {
  const canonicalById = new Map(products.map((p) => [p.id, p.canonicalId]));
  const grupos = new Map<string, T[]>();

  for (const product of products) {
    const canonico = resolveCanonicalId(product.id, canonicalById);
    const grupo = grupos.get(canonico) ?? [];
    grupo.push(product);
    grupos.set(canonico, grupo);
  }

  return grupos;
}
