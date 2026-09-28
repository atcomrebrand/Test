import { parseSimpleCsvImport } from "./simple-csv-import";

function row(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    ativo: "BBAS3",
    tipoInvestimento: "Acoes",
    tipoOrdem: "Compra",
    quantidade: "2.0",
    precoUnitario: "20.17",
    dataLancamento: "03/07/2026",
    fonte: "b3",
    ...overrides,
  };
}

describe("parseSimpleCsvImport", () => {
  it("parses a valid Acoes/Compra row into a BUY transaction", () => {
    const { transactions, skipped } = parseSimpleCsvImport([row()]);
    expect(skipped).toHaveLength(0);
    expect(transactions).toEqual([
      {
        ticker: "BBAS3",
        assetClass: "STOCK",
        assetName: null,
        type: "BUY",
        quantity: 2,
        unitPrice: 20.17,
        transactionDate: "2026-07-03",
        sourceLabel: "Compra - b3",
      },
    ]);
  });

  it("maps FIIs/Venda to a FII SELL transaction", () => {
    const { transactions, skipped } = parseSimpleCsvImport([
      row({ ativo: "HGLG11", tipoInvestimento: "FIIs", tipoOrdem: "Venda", quantidade: "4.0", precoUnitario: "156.33", dataLancamento: "23/03/2026" }),
    ]);
    expect(skipped).toHaveLength(0);
    expect(transactions[0]).toMatchObject({ ticker: "HGLG11", assetClass: "FII", type: "SELL" });
  });

  it("sorts transactions chronologically regardless of input order", () => {
    const { transactions } = parseSimpleCsvImport([
      row({ dataLancamento: "03/07/2026" }),
      row({ dataLancamento: "14/01/2026" }),
      row({ dataLancamento: "24/06/2026" }),
    ]);
    expect(transactions.map((t) => t.transactionDate)).toEqual(["2026-01-14", "2026-06-24", "2026-07-03"]);
  });

  it("skips a row with an unsupported Tipo de investimento instead of guessing", () => {
    const { transactions, skipped } = parseSimpleCsvImport([row({ tipoInvestimento: "Renda Fixa" })]);
    expect(transactions).toHaveLength(0);
    expect(skipped[0]).toMatchObject({ source: "csv", reason: expect.stringContaining("Renda Fixa") });
  });

  it("skips a row with an unrecognized Tipo de ordem", () => {
    const { transactions, skipped } = parseSimpleCsvImport([row({ tipoOrdem: "Bonificação" })]);
    expect(transactions).toHaveLength(0);
    expect(skipped[0].reason).toContain("Tipo de ordem não reconhecido");
  });

  it("skips rows with an empty ticker, invalid quantity/price, or invalid date", () => {
    const { transactions, skipped } = parseSimpleCsvImport([
      row({ ativo: "" }),
      row({ quantidade: "0" }),
      row({ precoUnitario: "-1" }),
      row({ dataLancamento: "not-a-date" }),
    ]);
    expect(transactions).toHaveLength(0);
    expect(skipped).toHaveLength(4);
  });

  it("ignores Total and Quantidade Total fields entirely — not part of the row shape", () => {
    const { transactions } = parseSimpleCsvImport([row()]);
    expect(transactions[0]).not.toHaveProperty("total");
    expect(transactions[0]).not.toHaveProperty("quantidadeTotal");
  });
});
