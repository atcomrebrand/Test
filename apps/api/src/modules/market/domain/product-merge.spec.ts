import { groupByCanonical, MergeCandidate, resolveCanonicalId, suggestProductMerges } from "./product-merge";
import { marketProductKey } from "./market-product-key";

/** Passa pelo mesmo normalizador da importação — sugerir em cima de outra chave seria testar uma
 *  coisa e rodar outra em produção. */
function produto(id: string, name: string): MergeCandidate {
  return { id, name, normalizedKey: marketProductKey(name) };
}

describe("suggestProductMerges", () => {
  it("casa o mercado que escreve a marca inteira com o que escreve só o essencial", () => {
    const sugestoes = suggestProductMerges([
      produto("1", "PAO BRIOCHE 520G"),
      produto("2", "PAO DE LEITE BRIOCHE WICKBOLD 520G"),
    ]);

    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0].ids).toEqual(["1", "2"]);
    expect(sugestoes[0].shared).toEqual(expect.arrayContaining(["PAO", "BRIOCHE"]));
  });

  it("embalagem diferente nunca é sugerida, por mais parecido que o nome seja", () => {
    expect(suggestProductMerges([produto("1", "PAO BRIOCHE 520G"), produto("2", "PAO BRIOCHE 300G")])).toEqual([]);
  });

  it("tamanho declarado só de um lado não é conflito", () => {
    const sugestoes = suggestProductMerges([produto("1", "PAO BRIOCHE"), produto("2", "PAO BRIOCHE WICKBOLD 520G")]);
    expect(sugestoes).toHaveLength(1);
  });

  it("uma palavra genérica em comum não é evidência de nada", () => {
    expect(suggestProductMerges([produto("1", "PAO FRANCES"), produto("2", "PAO BRIOCHE")])).toEqual([]);
    expect(suggestProductMerges([produto("1", "LEITE INTEGRAL"), produto("2", "LEITE CONDENSADO")])).toEqual([]);
  });

  it("marca a mais dos dois lados ainda casa", () => {
    const sugestoes = suggestProductMerges([
      produto("1", "LEITE INTEGRAL ITALAC 1L"),
      produto("2", "LEITE INTEGRAL PIRACANJUBA 1L"),
    ]);
    // Mesmo produto genérico, marcas diferentes: é exatamente o caso em que a decisão é do usuário,
    // então tem que ser sugerido — não decidido.
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0].score).toBeCloseTo(2 / 3, 5);
  });

  it("mais parecido primeiro", () => {
    const sugestoes = suggestProductMerges([
      produto("1", "CAFE TORRADO MOIDO PILAO 500G"),
      produto("2", "CAFE TORRADO MOIDO 500G"),
      produto("3", "CAFE TORRADO MOIDO TRES CORACOES EXTRAFORTE 500G"),
    ]);
    expect(sugestoes.length).toBeGreaterThan(1);
    expect(sugestoes[0].score).toBeGreaterThanOrEqual(sugestoes[1].score);
  });

  it("nunca sugere um produto com ele mesmo, nem repete o par invertido", () => {
    const sugestoes = suggestProductMerges([produto("1", "PAO BRIOCHE 520G"), produto("2", "PAO BRIOCHE ARTESANAL 520G")]);
    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0].ids[0]).not.toBe(sugestoes[0].ids[1]);
  });

  it("lista com um produto só não gera par", () => {
    expect(suggestProductMerges([produto("1", "PAO BRIOCHE 520G")])).toEqual([]);
    expect(suggestProductMerges([])).toEqual([]);
  });

  it("o limiar é ajustável pra quem quiser ver mais sugestões", () => {
    // Duas palavras em comum de quatro: parecidos o bastante pra alguém querer olhar, longe demais
    // pra entrar na lista padrão.
    const par = [produto("1", "SABAO EM PO OMO 800G"), produto("2", "SABAO PO ARIEL CONCENTRADO 800G")];
    expect(suggestProductMerges(par)).toEqual([]);

    const frouxo = suggestProductMerges(par, 0.4);
    expect(frouxo).toHaveLength(1);
    expect(frouxo[0].score).toBeCloseTo(0.5, 5);
  });

  it("palavra que difere só no gênero ainda conta como palavra diferente", () => {
    // "RECHEADA" e "RECHEADO" não se encontram, então sobra só "CHOCOLATE" em comum e o par cai.
    // É o limite conhecido de comparar palavra inteira — e errar pro lado de não sugerir é o certo.
    expect(
      suggestProductMerges([produto("1", "BOLACHA RECHEADA CHOCOLATE 140G"), produto("2", "BISCOITO RECHEADO CHOCOLATE 140G")], 0.1),
    ).toEqual([]);
  });
});

describe("resolveCanonicalId", () => {
  it("produto que ninguém uniu é o próprio canônico", () => {
    expect(resolveCanonicalId("a", new Map([["a", null]]))).toBe("a");
  });

  it("segue a corrente quando o canônico também foi unido depois", () => {
    const mapa = new Map([
      ["a", "b"],
      ["b", "c"],
      ["c", null],
    ]);
    expect(resolveCanonicalId("a", mapa)).toBe("c");
  });

  it("ciclo não trava a listagem", () => {
    const mapa = new Map([
      ["a", "b"],
      ["b", "a"],
    ]);
    expect(["a", "b"]).toContain(resolveCanonicalId("a", mapa));
  });
});

describe("groupByCanonical", () => {
  it("produto solto forma grupo de um, pra quem chama tratar tudo igual", () => {
    const grupos = groupByCanonical([{ id: "a", canonicalId: null }]);
    expect(grupos.get("a")).toHaveLength(1);
  });

  it("junta o absorvido com o canônico sob o id do canônico", () => {
    const grupos = groupByCanonical([
      { id: "a", canonicalId: null },
      { id: "b", canonicalId: "a" },
      { id: "c", canonicalId: "a" },
      { id: "d", canonicalId: null },
    ]);

    expect(grupos.size).toBe(2);
    expect(grupos.get("a")?.map((p) => p.id).sort()).toEqual(["a", "b", "c"]);
    expect(grupos.get("d")?.map((p) => p.id)).toEqual(["d"]);
  });
});
