import * as XLSX from "xlsx";

/** Column headers as B3's "Área do Investidor" exports them, mapped to the field names the
 *  backend's import parser expects. Matched by trimmed text (not position) so column re-ordering
 *  in a future export doesn't silently break parsing. */
const MOVIMENTACAO_HEADERS: Record<string, string> = {
  "Entrada/Saída": "entradaSaida",
  Data: "data",
  Movimentação: "movimentacao",
  Produto: "produto",
  Instituição: "instituicao",
  Quantidade: "quantidade",
  "Preço unitário": "precoUnitario",
  "Valor da Operação": "valorOperacao",
};

const NEGOCIACAO_HEADERS: Record<string, string> = {
  "Data do Negócio": "dataNegocio",
  "Tipo de Movimentação": "tipoMovimentacao",
  Mercado: "mercado",
  "Prazo/Vencimento": "prazoVencimento",
  Instituição: "instituicao",
  "Código de Negociação": "codigoNegociacao",
  Quantidade: "quantidade",
  Preço: "preco",
  Valor: "valor",
};

export class B3FileFormatError extends Error {}

function mapRows(rawRows: Record<string, unknown>[], headerMap: Record<string, string>, fileLabel: string): Record<string, unknown>[] {
  if (rawRows.length === 0) return [];

  const actualHeaders = Object.keys(rawRows[0]);
  const missing = Object.keys(headerMap).filter((expected) => !actualHeaders.some((actual) => actual.trim() === expected));
  if (missing.length > 0) {
    throw new B3FileFormatError(
      `Esse arquivo não parece ser um export de "${fileLabel}" da B3 — colunas esperadas não encontradas: ${missing.join(", ")}.`,
    );
  }

  return rawRows.map((row) => {
    const mapped: Record<string, unknown> = {};
    for (const [expectedHeader, field] of Object.entries(headerMap)) {
      const actualKey = actualHeaders.find((actual) => actual.trim() === expectedHeader);
      mapped[field] = actualKey ? row[actualKey] : null;
    }
    return mapped;
  });
}

async function readSheetRows(file: File): Promise<Record<string, unknown>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new B3FileFormatError(`"${file.name}" não tem nenhuma planilha.`);
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
}

/** Parses a B3 "Negociação" (trade blotter) export into the raw row shape the backend expects. */
export async function parseNegociacaoFile(file: File): Promise<Record<string, unknown>[]> {
  const rawRows = await readSheetRows(file);
  return mapRows(rawRows, NEGOCIACAO_HEADERS, "Negociação");
}

/** Parses a B3 "Movimentação" (extrato) export into the raw row shape the backend expects. */
export async function parseMovimentacaoFile(file: File): Promise<Record<string, unknown>[]> {
  const rawRows = await readSheetRows(file);
  return mapRows(rawRows, MOVIMENTACAO_HEADERS, "Movimentação");
}
