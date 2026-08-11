import { buildWhatsappLink, extractVariables, normalizeWhatsappNumber, renderTemplate } from "./message-template";

describe("renderTemplate", () => {
  const corpo =
    "Olá {{nome}}, tudo bem?\n\nSua assinatura do {{servico}} vence {{data_vencimento}}.\nO valor é {{valor}}.";

  it("substitui todas as variáveis", () => {
    const r = renderTemplate(corpo, {
      nome: "João",
      servico: "Serviço A",
      data_vencimento: "12/08/2026",
      valor: "R$ 30,00",
    });
    expect(r.text).toContain("Olá João, tudo bem?");
    expect(r.text).toContain("do Serviço A vence 12/08/2026");
    expect(r.text).toContain("O valor é R$ 30,00.");
    expect(r.missing).toEqual([]);
  });

  it("aceita espaço e caixa diferentes no placeholder", () => {
    const r = renderTemplate("Oi {{ Nome }}, seu {{SERVICO}}", { nome: "Ana", servico: "B" });
    expect(r.text).toBe("Oi Ana, seu B");
    expect(r.missing).toEqual([]);
  });

  it("mantém o placeholder visível quando falta o dado, em vez de apagar", () => {
    // Apagar geraria "Sua assinatura vence ." e a mensagem quebrada sairia sem ninguém notar.
    const r = renderTemplate(corpo, { nome: "João", servico: "A" });
    expect(r.text).toContain("{{data_vencimento}}");
    expect(r.missing).toEqual(["data_vencimento", "valor"]);
  });

  it("trata string vazia como ausente", () => {
    const r = renderTemplate("Oi {{nome}}", { nome: "" });
    expect(r.missing).toEqual(["nome"]);
  });

  it("aceita número zero como valor válido", () => {
    // 0 crédito é justamente o caso do alerta de saldo baixo — não pode virar "faltando".
    const r = renderTemplate("Saldo: {{saldo_creditos}}", { saldo_creditos: 0 });
    expect(r.text).toBe("Saldo: 0");
    expect(r.missing).toEqual([]);
  });

  it("não repete a mesma variável faltante", () => {
    const r = renderTemplate("{{x}} e {{x}} de novo", {});
    expect(r.missing).toEqual(["x"]);
  });

  it("devolve o corpo intacto quando não há placeholder", () => {
    expect(renderTemplate("Bom dia!", {}).text).toBe("Bom dia!");
  });
});

describe("extractVariables", () => {
  it("lista na ordem de aparição, sem repetir", () => {
    expect(extractVariables("{{nome}} do {{servico}}, {{nome}} de novo")).toEqual(["nome", "servico"]);
  });

  it("é vazio sem variáveis", () => {
    expect(extractVariables("texto puro")).toEqual([]);
  });
});

describe("normalizeWhatsappNumber", () => {
  it("põe o 55 em número nacional e limpa a máscara", () => {
    expect(normalizeWhatsappNumber("(11) 98765-4321")).toBe("5511987654321");
    expect(normalizeWhatsappNumber("11 3456-7890")).toBe("551134567890");
  });

  it("não duplica o país quando já veio com ele", () => {
    expect(normalizeWhatsappNumber("+55 11 98765-4321")).toBe("5511987654321");
  });

  it("recusa número curto demais", () => {
    expect(normalizeWhatsappNumber("1234")).toBeNull();
    expect(normalizeWhatsappNumber("")).toBeNull();
  });
});

describe("buildWhatsappLink", () => {
  it("monta o link com a mensagem escapada", () => {
    const link = buildWhatsappLink("(11) 98765-4321", "Olá João, tudo bem?");
    expect(link).toBe("https://wa.me/5511987654321?text=Ol%C3%A1%20Jo%C3%A3o%2C%20tudo%20bem%3F");
  });

  it("é null quando o telefone não serve", () => {
    expect(buildWhatsappLink("123", "oi")).toBeNull();
  });
});
