import { marketProductKey } from "./market-product-key";

describe("marketProductKey", () => {
  it("groups the same product written with and without accents/case differences", () => {
    expect(marketProductKey("ARROZ TIO JOÃO 5KG")).toBe(marketProductKey("arroz tio joao 5kg"));
  });

  it("groups a pack size written apart from its unit with one written glued", () => {
    expect(marketProductKey("ARROZ TIO JOAO 5 KG")).toBe(marketProductKey("ARROZ TIO JOAO 5KG"));
  });

  it("expands the abbreviations stores use interchangeably", () => {
    expect(marketProductKey("LEITE INT 1LT")).toBe(marketProductKey("LEITE INTEGRAL 1 LITRO"));
  });

  it("drops punctuation so a printed dot or hyphen doesn't split a product in two", () => {
    expect(marketProductKey("CAFE 3 CORACOES - 500G")).toBe(marketProductKey("CAFE 3 CORACOES 500G"));
  });

  it("keeps different pack sizes apart — 1kg and 5kg are not the same product", () => {
    expect(marketProductKey("ARROZ TIO JOAO 1KG")).not.toBe(marketProductKey("ARROZ TIO JOAO 5KG"));
  });

  it("keeps genuinely different products apart", () => {
    expect(marketProductKey("LEITE INTEGRAL 1L")).not.toBe(marketProductKey("LEITE DESNATADO 1L"));
  });

  it("collapses repeated whitespace without merging words", () => {
    expect(marketProductKey("  BANANA    PRATA  KG ")).toBe("BANANA PRATA KG");
  });

  it("returns an empty key for an empty description rather than throwing", () => {
    expect(marketProductKey("")).toBe("");
    expect(marketProductKey("   ")).toBe("");
  });
});
