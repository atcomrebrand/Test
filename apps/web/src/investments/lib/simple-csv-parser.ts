/** Column headers for the simpler CSV export (one row per transaction, no separate dividend
 *  file) — matched by trimmed text, not position, same reasoning as the B3 parser. */
const SIMPLE_CSV_HEADERS: Record<string, string> = {
  Ativo: "ativo",
  "Tipo de investimento": "tipoInvestimento",
  "Tipo de ordem": "tipoOrdem",
  Quantidade: "quantidade",
  "Preco unitario": "precoUnitario",
  "Data do lancamento": "dataLancamento",
  Fonte: "fonte",
};

export class SimpleCsvFormatError extends Error {}

/** A small hand-rolled RFC4180-ish line splitter instead of SheetJS: SheetJS's CSV reader
 *  auto-detects date-looking text and converts it to an Excel serial number (or, with
 *  cellDates, a JS Date) using its own locale guess — for an ambiguous date like "03/07/2026" it
 *  assumes US MM/DD, silently turning July 3rd into March 7th. Keeping every field a plain
 *  string sidesteps that entirely: the backend's own parseBrDate already parses "dd/mm/yyyy"
 *  correctly and explicitly. */
function parseCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];

    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export async function parseSimpleCsvFile(file: File): Promise<Record<string, unknown>[]> {
  const text = await file.text();
  const lines = parseCsvLines(text);
  if (lines.length === 0) throw new SimpleCsvFormatError(`"${file.name}" está vazio.`);

  const actualHeaders = lines[0].map((h) => h.trim());
  const missing = Object.keys(SIMPLE_CSV_HEADERS).filter((expected) => !actualHeaders.includes(expected));
  if (missing.length > 0) {
    throw new SimpleCsvFormatError(`Esse arquivo não parece estar no formato esperado — colunas não encontradas: ${missing.join(", ")}.`);
  }

  return lines.slice(1).map((cols) => {
    const mapped: Record<string, unknown> = {};
    for (const [expectedHeader, field] of Object.entries(SIMPLE_CSV_HEADERS)) {
      const idx = actualHeaders.indexOf(expectedHeader);
      mapped[field] = idx >= 0 ? (cols[idx]?.trim() ?? null) : null;
    }
    return mapped;
  });
}
