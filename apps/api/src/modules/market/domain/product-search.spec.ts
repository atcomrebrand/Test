import { searchProducts } from "./product-search";

const PRODUTOS = [
  { id: "1", name: "CAFE PILAO 500G" },
  { id: "2", name: "BOMBOM CAFE TRUFADO 90G" },
  { id: "3", name: "ARROZ TIO JOAO 5KG" },
  { id: "4", name: "ACUCAR UNIAO 1KG" },
  { id: "5", name: "LEITE INTEGRAL ITALAC 1L" },
];

describe("searchProducts", () => {
  it("acha ignorando acento e caixa — a nota vem sem acento e a pergunta vem com", () => {
    expect(searchProducts(PRODUTOS, "café").map((p) => p.id)).toEqual(["1", "2"]);
    expect(searchProducts(PRODUTOS, "AÇÚCAR").map((p) => p.id)).toEqual(["4"]);
  });

  it("casa as palavras em qualquer ordem, e não a frase inteira", () => {
    // Ninguém pergunta "CAFE PILAO 500G"; pergunta "pilão café" ou "café pilão".
    expect(searchProducts(PRODUTOS, "pilao cafe").map((p) => p.id)).toEqual(["1"]);
    expect(searchProducts(PRODUTOS, "joao arroz").map((p) => p.id)).toEqual(["3"]);
  });

  it("põe primeiro o produto cujo nome está mais perto do termo", () => {
    // "CAFE PILAO 500G" responde melhor a "café" do que "BOMBOM CAFE TRUFADO 90G".
    expect(searchProducts(PRODUTOS, "cafe")[0].id).toBe("1");
  });

  it("exige todas as palavras — casar só uma traria o supermercado inteiro", () => {
    expect(searchProducts(PRODUTOS, "cafe arroz")).toEqual([]);
  });

  it("devolve vazio pra termo vazio ou só pontuação, em vez de listar tudo", () => {
    expect(searchProducts(PRODUTOS, "")).toEqual([]);
    expect(searchProducts(PRODUTOS, "   ")).toEqual([]);
    expect(searchProducts(PRODUTOS, "!!!")).toEqual([]);
  });

  it("respeita o limite", () => {
    expect(searchProducts(PRODUTOS, "a", 2)).toHaveLength(2);
  });
});
