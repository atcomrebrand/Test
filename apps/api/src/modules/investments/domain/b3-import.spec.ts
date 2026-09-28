import {
  baseTickerForFractional,
  inferAssetClass,
  parseB3Import,
  parseBrDate,
  parseProductField,
  toNumberOrNull,
  B3MovimentacaoRow,
  B3NegociacaoRow,
} from "./b3-import";

describe("toNumberOrNull", () => {
  it("parses plain numbers", () => {
    expect(toNumberOrNull(20.17)).toBe(20.17);
  });
  it("parses numeric strings, including comma decimals", () => {
    expect(toNumberOrNull("40.34")).toBe(40.34);
    expect(toNumberOrNull("40,34")).toBe(40.34);
  });
  it("treats B3's dash placeholder as null", () => {
    expect(toNumberOrNull("-")).toBeNull();
    expect(toNumberOrNull("")).toBeNull();
  });
  it("returns null for garbage", () => {
    expect(toNumberOrNull("abc")).toBeNull();
    expect(toNumberOrNull(undefined)).toBeNull();
    expect(toNumberOrNull(null)).toBeNull();
  });
});

describe("parseBrDate", () => {
  it("parses dd/mm/yyyy into ISO", () => {
    expect(parseBrDate("17/07/2026")).toBe("2026-07-17");
  });
  it("falls back to Date parsing for an ISO string", () => {
    expect(parseBrDate("2026-07-17T00:00:00.000Z")).toBe("2026-07-17");
  });
  it("returns null for garbage", () => {
    expect(parseBrDate("not a date")).toBeNull();
    expect(parseBrDate(12345)).toBeNull();
  });
});

describe("parseProductField", () => {
  it("splits ticker and name", () => {
    expect(parseProductField("BBAS3 - BANCO DO BRASIL S/A")).toEqual({ ticker: "BBAS3", name: "BANCO DO BRASIL S/A" });
  });
  it("trims trailing whitespace some B3 exports include", () => {
    expect(parseProductField("BBAS3 - BCO BRASIL S.A.                                   ")).toEqual({
      ticker: "BBAS3",
      name: "BCO BRASIL S.A.",
    });
  });
  it("keeps embedded ' - ' in the name intact", () => {
    expect(parseProductField("PETR4 - PETROLEO BRASILEIRO S/A - PETROBRAS")).toEqual({
      ticker: "PETR4",
      name: "PETROLEO BRASILEIRO S/A - PETROBRAS",
    });
  });
});

describe("inferAssetClass", () => {
  it("classifies FIIs by name, not just ticker suffix", () => {
    expect(inferAssetClass("PÁTRIA LOG - FDO INV IMOB - RESPONSABILIDADE LTDA.", "HGLG11")).toBe("FII");
    expect(inferAssetClass("XP LOG FUNDO DE INVESTIMENTO IMOBILIARIO FII", "XPLG11")).toBe("FII");
  });
  it("classifies everything else as STOCK, including 11-suffixed units", () => {
    expect(inferAssetClass("BANCO DO BRASIL S/A", "BBAS3")).toBe("STOCK");
    expect(inferAssetClass("TAESA UNITS", "TAEE11")).toBe("STOCK");
  });
});

describe("baseTickerForFractional", () => {
  it("extracts the base ticker from a fractional-lot code", () => {
    expect(baseTickerForFractional("BBAS3F")).toBe("BBAS3");
    expect(baseTickerForFractional("HGLG11F")).toBe("HGLG11");
  });
  it("returns null for a non-fractional ticker", () => {
    expect(baseTickerForFractional("BBAS3")).toBeNull();
  });
});

// Real row shapes taken from the user's actual B3 exports.
const negociacao: B3NegociacaoRow[] = [
  { dataNegocio: "03/07/2026", tipoMovimentacao: "Compra", mercado: "Mercado Fracionário", prazoVencimento: "-", instituicao: "INTER", codigoNegociacao: "BBAS3F", quantidade: 2, preco: 20.17, valor: 40.34 },
  { dataNegocio: "23/03/2026", tipoMovimentacao: "Venda", mercado: "Mercado à Vista", prazoVencimento: "-", instituicao: "C6", codigoNegociacao: "HGLG11", quantidade: 4, preco: 156.33, valor: 625.32 },
];

const movimentacao: B3MovimentacaoRow[] = [
  { entradaSaida: "Debito", data: "17/07/2026", movimentacao: "Transferência - Liquidação", produto: "BBAS3 - BANCO DO BRASIL S/A", instituicao: "INTER", quantidade: 4, precoUnitario: "-", valorOperacao: "-" },
  { entradaSaida: "Credito", data: "17/07/2026", movimentacao: "Empréstimo", produto: "BBAS3 - BCO BRASIL S.A.                                   ", instituicao: "INTER", quantidade: 4, precoUnitario: "-", valorOperacao: "-" },
  { entradaSaida: "Credito", data: "12/05/2026", movimentacao: "Empréstimo", produto: "PETR4 - PETROLEO BRASILEIRO S.A. PETROBRAS                ", instituicao: "C6", quantidade: 3, precoUnitario: "-", valorOperacao: 0.02 },
  { entradaSaida: "Credito", data: "14/07/2026", movimentacao: "Rendimento", produto: "HGLG11 - PÁTRIA LOG - FDO INV IMOB - RESPONSABILIDADE LTDA.", instituicao: "C6", quantidade: 3, precoUnitario: 1.1, valorOperacao: 3.3 },
  { entradaSaida: "Credito", data: "01/07/2026", movimentacao: "Dividendo", produto: "LOGG3 - LOG COMMERCIAL PROPERTIES", instituicao: "C6", quantidade: 3, precoUnitario: 2.86, valorOperacao: 8.57 },
  { entradaSaida: "Credito", data: "30/06/2026", movimentacao: "Juros Sobre Capital Próprio", produto: "CMIG4 - CIA. ENERGETICA DE MINAS GERAIS- CEMIG", instituicao: "C6", quantidade: 2, precoUnitario: 0.106, valorOperacao: 0.18 },
  { entradaSaida: "Credito", data: "22/06/2026", movimentacao: "Reembolso", produto: "PETR4 - PETROLEO BRASILEIRO S.A. PETROBRAS                ", instituicao: "C6", quantidade: 0, precoUnitario: "-", valorOperacao: 0.82 },
  { entradaSaida: "Credito", data: "24/02/2026", movimentacao: "Leilão de Fração", produto: "GOAU4 - METALURGICA GERDAU S.A.", instituicao: "C6", quantidade: 0.67, precoUnitario: 9.69, valorOperacao: 6.45 },
  { entradaSaida: "Debito", data: "30/01/2026", movimentacao: "Fração em Ativos", produto: "GOAU4 - METALURGICA GERDAU S.A.", instituicao: "C6", quantidade: 0.67, precoUnitario: "-", valorOperacao: "-" },
  { entradaSaida: "Credito", data: "22/12/2025", movimentacao: "Bonificação em Ativos", produto: "GOAU4 - METALURGICA GERDAU S.A.", instituicao: "C6", quantidade: 0.67, precoUnitario: "-", valorOperacao: "-" },
  { entradaSaida: "Debito", data: "09/07/2026", movimentacao: "Direitos de Subscrição - Não Exercido", produto: "MXRF12 - MAXI RENDA FDO INV IMOB - FII", instituicao: "C6", quantidade: 0, precoUnitario: "-", valorOperacao: "-" },
  { entradaSaida: "Credito", data: "26/06/2026", movimentacao: "Direito de Subscrição", produto: "MXRF12 - MAXI RENDA FDO INV IMOB - FII", instituicao: "C6", quantidade: 2, precoUnitario: "-", valorOperacao: "-" },
  { entradaSaida: "Credito", data: "08/07/2026", movimentacao: "Cessão de Direitos", produto: "MXRF12 - MAXI RENDA FDO INV IMOB - FII", instituicao: "C6", quantidade: 2, precoUnitario: "-", valorOperacao: "-" },
  { entradaSaida: "Debito", data: "08/07/2026", movimentacao: "Cessão de Direitos - Solicitada", produto: "MXRF12 - MAXI RENDA FDO INV IMOB - FII", instituicao: "C6", quantidade: 2, precoUnitario: "-", valorOperacao: "-" },
  { entradaSaida: "Credito", data: "29/06/2026", movimentacao: "Atualização", produto: "VALE3 - VALE S.A.", instituicao: "C6", quantidade: 1, precoUnitario: "-", valorOperacao: "-" },
];

describe("parseB3Import", () => {
  const plan = parseB3Import(negociacao, movimentacao);

  it("imports Negociação Compra/Venda rows as transactions, keeping fractional tickers distinct", () => {
    const bbas3f = plan.transactions.find((t) => t.ticker === "BBAS3F");
    expect(bbas3f).toMatchObject({ type: "BUY", quantity: 2, unitPrice: 20.17, transactionDate: "2026-07-03", assetClass: "STOCK" });

    const hglg11Sell = plan.transactions.find((t) => t.ticker === "HGLG11" && t.type === "SELL" && t.transactionDate === "2026-03-23");
    expect(hglg11Sell).toMatchObject({ quantity: 4, unitPrice: 156.33, assetClass: "FII" });
  });

  it("never imports Transferência/Transferência - Liquidação (duplicate of Negociação)", () => {
    expect(plan.transactions.some((t) => t.ticker === "BBAS3" && t.type === "BUY" && t.quantity === 4)).toBe(false);
    const skippedReason = plan.skipped.find((s) => s.description.includes("Transferência - Liquidação"))?.reason;
    expect(skippedReason).toMatch(/já contabilizada/i);
  });

  it("maps Dividendo/JCP/Rendimento to the right income type with the exact amount", () => {
    expect(plan.incomes.find((i) => i.ticker === "LOGG3")).toMatchObject({ type: "DIVIDENDO", amount: 8.57, paymentDate: "2026-07-01" });
    expect(plan.incomes.find((i) => i.ticker === "CMIG4")).toMatchObject({ type: "JCP", amount: 0.18 });
    expect(plan.incomes.find((i) => i.ticker === "HGLG11" && i.type === "RENDIMENTO")).toMatchObject({ amount: 3.3, assetClass: "FII" });
  });

  it("maps Reembolso to OUTRO income with its real value", () => {
    expect(plan.incomes.find((i) => i.sourceLabel === "Reembolso")).toMatchObject({ ticker: "PETR4", type: "OUTRO", amount: 0.82 });
  });

  it("only imports Empréstimo rows that carry a real value, as OUTRO income", () => {
    const loan = plan.incomes.find((i) => i.sourceLabel === "Aluguel de ações (BTC)");
    expect(loan).toMatchObject({ ticker: "PETR4", amount: 0.02 });
    // the BBAS3 Empréstimo row had no value -> must be skipped, not counted as income
    expect(plan.incomes.some((i) => i.ticker === "BBAS3")).toBe(false);
    expect(plan.skipped.some((s) => s.description.includes("Empréstimo") && s.reason.includes("custódia"))).toBe(true);
  });

  it("maps Leilão de Fração to a SELL transaction", () => {
    const auction = plan.transactions.find((t) => t.sourceLabel === "Leilão de fração");
    expect(auction).toMatchObject({ ticker: "GOAU4", type: "SELL", quantity: 0.67, unitPrice: 9.69 });
  });

  it("skips Fração em Ativos (the debit leg already covered by Leilão de Fração)", () => {
    expect(plan.skipped.some((s) => s.description.includes("Fração em Ativos"))).toBe(true);
    expect(plan.transactions.filter((t) => t.ticker === "GOAU4" && t.quantity === 0.67).length).toBe(2); // auction SELL + bonus BUY only
  });

  it("maps Bonificação em Ativos to a zero-cost BUY", () => {
    const bonus = plan.transactions.find((t) => t.sourceLabel === "Bonificação em ativos");
    expect(bonus).toMatchObject({ ticker: "GOAU4", type: "BUY", quantity: 0.67, unitPrice: 0 });
  });

  it("skips subscription rights and pending assignment rows entirely (no cash/position impact)", () => {
    for (const label of ["Direitos de Subscrição - Não Exercido", "Direito de Subscrição", "Cessão de Direitos - Solicitada"]) {
      expect(plan.skipped.some((s) => s.description.includes(label))).toBe(true);
    }
    expect(plan.incomes.some((i) => i.ticker === "MXRF12")).toBe(false);
    expect(plan.transactions.some((t) => t.ticker === "MXRF12")).toBe(false);
  });

  it("skips Cessão de Direitos when it has no value, but would import it as OUTRO income if it did", () => {
    expect(plan.incomes.some((i) => i.sourceLabel === "Cessão de direitos de subscrição")).toBe(false);
    const withValue = parseB3Import([], [
      { entradaSaida: "Credito", data: "01/01/2026", movimentacao: "Cessão de Direitos", produto: "MXRF12 - MAXI RENDA FDO INV IMOB - FII", instituicao: "C6", quantidade: 1, precoUnitario: "-", valorOperacao: 2.5 },
    ]);
    expect(withValue.incomes[0]).toMatchObject({ ticker: "MXRF12", type: "OUTRO", amount: 2.5, sourceLabel: "Cessão de direitos de subscrição" });
  });

  it("skips Atualização (no value, not a real cash/position event)", () => {
    expect(plan.skipped.some((s) => s.description.includes("Atualização"))).toBe(true);
  });

  it("redirects income to the fractional ticker when the user only holds the fractional variant", () => {
    const result = parseB3Import(
      [{ dataNegocio: "01/01/2026", tipoMovimentacao: "Compra", mercado: "Mercado Fracionário", codigoNegociacao: "ABCD3F", quantidade: 2, preco: 10, valor: 20 }],
      [{ data: "10/01/2026", movimentacao: "Dividendo", produto: "ABCD3 - EMPRESA EXEMPLO S.A.", quantidade: 2, precoUnitario: 0.5, valorOperacao: 1 }],
    );
    expect(result.incomes[0].ticker).toBe("ABCD3F");
  });

  it("keeps income on the base ticker when the user holds the round lot", () => {
    const result = parseB3Import(
      [{ dataNegocio: "01/01/2026", tipoMovimentacao: "Compra", mercado: "Mercado à Vista", codigoNegociacao: "ABCD3", quantidade: 100, preco: 10, valor: 1000 }],
      [{ data: "10/01/2026", movimentacao: "Dividendo", produto: "ABCD3 - EMPRESA EXEMPLO S.A.", quantidade: 100, precoUnitario: 0.5, valorOperacao: 50 }],
    );
    expect(result.incomes[0].ticker).toBe("ABCD3");
  });

  it("skips negociação rows with an unrecognized tipo, invalid quantity/price, or invalid date", () => {
    const result = parseB3Import(
      [
        { dataNegocio: "01/01/2026", tipoMovimentacao: "Bonificação", mercado: "-", codigoNegociacao: "XPTO3", quantidade: 1, preco: 1 },
        { dataNegocio: "01/01/2026", tipoMovimentacao: "Compra", mercado: "-", codigoNegociacao: "XPTO3", quantidade: 0, preco: 1 },
        { dataNegocio: "01/01/2026", tipoMovimentacao: "Compra", mercado: "-", codigoNegociacao: "XPTO3", quantidade: 1, preco: "-" },
        { dataNegocio: "not-a-date", tipoMovimentacao: "Compra", mercado: "-", codigoNegociacao: "XPTO3", quantidade: 1, preco: 1 },
      ],
      [],
    );
    expect(result.transactions).toHaveLength(0);
    expect(result.skipped).toHaveLength(4);
  });
});
