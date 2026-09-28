/**
 * Pure parser for a simpler, already-normalized CSV export (one row per transaction: Ativo, Tipo
 * de investimento, Tipo de ordem, Quantidade, Preço unitário, Total, Quantidade Total, Data do
 * lançamento, Fonte). Unlike B3's raw Negociação/Movimentação exports, this format has no
 * settlement-duplication concern and carries no dividend/provento rows at all — those don't need
 * to be imported here because B3ImportService's dividend-suggestion logic derives them
 * automatically from BRAPI's dividend history against the position these transactions establish,
 * regardless of which import path produced the transactions. "Total" and "Quantidade Total" are
 * the source tool's own running totals — redundant with quantity × price and the position this
 * app recalculates from scratch, so neither is used here.
 */

import { ImportAssetClass, ImportedTransaction, SkippedRow, parseBrDate, toNumberOrNull } from "./b3-import";

export interface SimpleImportRow {
  ativo: unknown;
  tipoInvestimento: unknown;
  tipoOrdem: unknown;
  quantidade: unknown;
  precoUnitario: unknown;
  dataLancamento: unknown;
  fonte?: unknown;
}

const ASSET_CLASS_BY_LABEL: Record<string, ImportAssetClass> = {
  ACOES: "STOCK",
  "AÇÕES": "STOCK",
  FIIS: "FII",
  FII: "FII",
};

const ORDER_TYPE_BY_LABEL: Record<string, "BUY" | "SELL"> = {
  COMPRA: "BUY",
  VENDA: "SELL",
};

export function parseSimpleCsvImport(rows: SimpleImportRow[]): { transactions: ImportedTransaction[]; skipped: SkippedRow[] } {
  const transactions: ImportedTransaction[] = [];
  const skipped: SkippedRow[] = [];

  for (const row of rows) {
    const ticker = typeof row.ativo === "string" ? row.ativo.trim().toUpperCase() : "";
    const tipoInvestimento = typeof row.tipoInvestimento === "string" ? row.tipoInvestimento.trim() : "";
    const tipoOrdem = typeof row.tipoOrdem === "string" ? row.tipoOrdem.trim() : "";
    const quantity = toNumberOrNull(row.quantidade);
    const unitPrice = toNumberOrNull(row.precoUnitario);
    const transactionDate = parseBrDate(row.dataLancamento);
    const fonte = typeof row.fonte === "string" ? row.fonte.trim() : "";
    const description = `${row.dataLancamento ?? ""} ${tipoOrdem} ${ticker}`.trim();

    if (!ticker) {
      skipped.push({ source: "csv", description, reason: "Ativo vazio" });
      continue;
    }

    const assetClass = ASSET_CLASS_BY_LABEL[tipoInvestimento.toUpperCase()];
    if (!assetClass) {
      skipped.push({ source: "csv", description, reason: `Tipo de investimento não suportado neste importador: "${tipoInvestimento || "vazio"}"` });
      continue;
    }

    const type = ORDER_TYPE_BY_LABEL[tipoOrdem.toUpperCase()];
    if (!type) {
      skipped.push({ source: "csv", description, reason: `Tipo de ordem não reconhecido: "${tipoOrdem || "vazio"}"` });
      continue;
    }

    if (quantity === null || quantity <= 0) {
      skipped.push({ source: "csv", description, reason: "Quantidade inválida" });
      continue;
    }
    if (unitPrice === null || unitPrice <= 0) {
      skipped.push({ source: "csv", description, reason: "Preço unitário inválido" });
      continue;
    }
    if (!transactionDate) {
      skipped.push({ source: "csv", description, reason: "Data do lançamento inválida" });
      continue;
    }

    transactions.push({
      ticker,
      assetClass,
      assetName: null,
      type,
      quantity,
      unitPrice,
      transactionDate,
      sourceLabel: fonte ? `${tipoOrdem} - ${fonte}` : tipoOrdem,
    });
  }

  return { transactions: transactions.sort((a, b) => a.transactionDate.localeCompare(b.transactionDate)), skipped };
}
