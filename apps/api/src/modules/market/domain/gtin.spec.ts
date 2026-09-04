import { parseGtin } from "./gtin";

describe("parseGtin", () => {
  // Códigos copiados de uma nota real (Shibata, Pindamonhangaba, 2026-08). Testar com o que a
  // fonte de verdade imprime é o que impede a regra de funcionar só no papel.
  const DA_NOTA = {
    "REFRIG C.COLA ZERO 2l": "7894900701517",
    "PILHA ELGIN ZINCO CARVAO": "7897013538025",
    "HAMB SADIA BOVINO 672g": "7893000387096",
    "PAO HAMB TP BRIOCHE 520g": "7896002304184",
  };

  it("aceita os EAN-13 dos produtos embalados", () => {
    for (const [nome, codigo] of Object.entries(DA_NOTA)) {
      expect(parseGtin(codigo)).toBe(codigo.padStart(14, "0"));
      expect(nome).toBeTruthy();
    }
  });

  it("rejeita o código curto da balança — não é código de barras, é numeração da loja", () => {
    // Na mesma nota: queijo mussarela, queijo frescal e tomate, todos vendidos por peso.
    expect(parseGtin("6339")).toBeNull();
    expect(parseGtin("5707")).toBeNull();
    expect(parseGtin("354")).toBeNull();
  });

  it("rejeita 13 dígitos com verificador errado — é o que separa EAN de numeração interna", () => {
    // O EAN do pão com o último dígito trocado.
    expect(parseGtin("7896002304185")).toBeNull();
    expect(parseGtin("1234567890123")).toBeNull();
  });

  it("normaliza pra 14 dígitos: o mesmo produto pode vir como UPC-12 num mercado e EAN-13 noutro", () => {
    // 036000291452 é um UPC-A válido; como EAN-13 é o mesmo número com um zero na frente.
    expect(parseGtin("036000291452")).toBe("00036000291452");
    expect(parseGtin("0036000291452")).toBe("00036000291452");
    expect(parseGtin("036000291452")).toBe(parseGtin("0036000291452"));
  });

  it("aceita EAN-8", () => {
    expect(parseGtin("96385074")).toBe("00000096385074");
  });

  it("ignora pontuação e espaço, que a página às vezes traz junto", () => {
    expect(parseGtin(" 7896002304184 ")).toBe("07896002304184");
    expect(parseGtin("789.600.230.418-4")).toBe("07896002304184");
  });

  it("código ausente, vazio ou de comprimento estranho não é GTIN", () => {
    expect(parseGtin(null)).toBeNull();
    expect(parseGtin(undefined)).toBeNull();
    expect(parseGtin("")).toBeNull();
    expect(parseGtin("ABC")).toBeNull();
    expect(parseGtin("123456789")).toBeNull();
  });

  it('"sem GTIN" gravado como zeros não vira identidade', () => {
    expect(parseGtin("0000000000000")).toBeNull();
    expect(parseGtin("00000000")).toBeNull();
  });
});
