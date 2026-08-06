export interface ParsedNfceItem {
  /** Description exactly as the store printed it on the nota. */
  description: string;
  /** The store's own internal product code — store-specific, NOT a barcode, so it can't identify
   *  the same product across different supermarkets. */
  storeCode: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface ParsedNfce {
  storeName: string | null;
  storeCnpj: string | null;
  /** 44-digit NFC-e access key — the natural identity of a nota, used to reject re-imports. */
  accessKey: string | null;
  /** ISO yyyy-mm-dd. */
  purchaseDate: string | null;
  /** "Valor a pagar" when the page exposes it; null falls back to summing the items. */
  totalAmount: number | null;
  items: ParsedNfceItem[];
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** The consulta page renders every item field as "<strong>Label:</strong>value" inside one span,
 *  so the label has to come off before the value is usable. Everything up to the first colon is
 *  the label; text with no colon is returned untouched. */
function valueAfterLabel(text: string | null): string | null {
  if (text === null) return null;
  const stripped = text.replace(/^[^:]*:/, "").trim();
  return stripped === "" ? null : stripped;
}

/** Finds the first element carrying `className` and returns its text content. Deliberately does not
 *  handle same-tag nesting (a <span> inside a <span> would cut the match short) — the consulta
 *  page only ever nests <strong> labels inside these spans, and a parser that fails visibly on an
 *  unexpected layout beats one that silently returns half a value. */
function textByClass(fragment: string, className: string): string | null {
  const re = new RegExp(`<(span|td|div|h\\d)[^>]*class="[^"]*\\b${className}\\b[^"]*"[^>]*>([\\s\\S]*?)</\\1>`, "i");
  const match = fragment.match(re);
  return match ? stripTags(match[2]) : null;
}

/** pt-BR money/quantity: "1.234,56" → 1234.56, "0,586" → 0.586. */
function parsePtBrNumber(raw: string | null): number | null {
  if (raw === null) return null;
  const cleaned = raw.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".").trim();
  if (cleaned === "" || cleaned === "-") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** "15/07/2026 18:32:11" → "2026-07-15". */
function parsePtBrDate(raw: string | null): string | null {
  const match = raw?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function firstMatch(html: string, re: RegExp): string | null {
  const match = html.match(re);
  return match ? match[1] : null;
}

/**
 * Pulls the 44-digit access key out of whatever the QR code scan produced. NFC-e QR codes encode a
 * `p=` query param whose first pipe-separated field is the key (`chNFe|nVersao|tpAmb|...`), but a
 * user may equally paste a plain key with or without the spacing the nota prints it with — all
 * three forms resolve to the same 44 digits. Returns null when no 44-digit run is present at all,
 * which the caller surfaces as "isso não parece uma nota" instead of fetching a bogus URL.
 */
/** The decoded `p=` payload of an NFC-e QR code — "chNFe|nVersao|tpAmb|cIdToken|cHashQRCode".
 *  Matched as a query parameter rather than by splitting on the first "p=" found anywhere, so a
 *  path segment that happens to contain those two characters can't be mistaken for the payload. */
export function extractQrPayload(input: string): string | null {
  const pParam = firstMatch(input, /[?&]p=([^&\s]+)/i);
  return pParam ? decodeURIComponent(pParam) : null;
}

export function extractAccessKey(input: string): string | null {
  const payload = extractQrPayload(input);
  const candidate = payload ? payload.split("|")[0] : input;
  const digits = candidate.replace(/\D/g, "");
  if (digits.length === 44) return digits;

  // A key pasted with the spacing the nota prints it with ("1234 5678 ...") survives digit
  // stripping; anything else is rejected rather than salvaged. Scanning a whole document for "any
  // 44-digit run" would happily concatenate unrelated numbers into a plausible-looking key, so
  // that shortcut is deliberately absent — see accessKeyFromPage for the page-level lookup.
  return null;
}

/** The consulta page prints the key inside its own element, so it's read from there rather than by
 *  hunting for digit runs across the whole document (which would risk splicing unrelated numbers
 *  into a bogus 44-digit "key"). */
function accessKeyFromPage(html: string): string | null {
  const labelled = firstMatch(html, /<span[^>]*class="[^"]*\bchave\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  const digits = labelled ? stripTags(labelled).replace(/\D/g, "") : "";
  return digits.length === 44 ? digits : null;
}

/** Splits the items table into rows. The consulta page marks each item row with id="Item + N". */
function itemRows(html: string): string[] {
  const table = firstMatch(html, /<table[^>]*id="tabResult"[^>]*>([\s\S]*?)<\/table>/i);
  if (!table) return [];
  return Array.from(table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi), (m) => m[1]);
}

function parseItem(row: string): ParsedNfceItem | null {
  const description = textByClass(row, "txtTit");
  if (!description) return null;

  const quantity = parsePtBrNumber(valueAfterLabel(textByClass(row, "Rqtd")));
  const unitPrice = parsePtBrNumber(valueAfterLabel(textByClass(row, "RvlUnit")));
  const totalPrice = parsePtBrNumber(textByClass(row, "valor"));
  if (quantity === null || quantity <= 0 || unitPrice === null) return null;

  const rawCode = valueAfterLabel(textByClass(row, "RCod"));
  const unit = valueAfterLabel(textByClass(row, "RUN"));

  return {
    description,
    storeCode: rawCode ? rawCode.replace(/[()]/g, "").trim() || null : null,
    quantity,
    unit: unit ?? "UN",
    unitPrice,
    // A missing line total is derivable — quantity × unit price is exactly what the store charged.
    totalPrice: totalPrice ?? Math.round(quantity * unitPrice * 100) / 100,
  };
}

/**
 * Parses SEFAZ-SP's public NFC-e consulta page into the item list a grocery purchase is built
 * from. Fail-soft throughout: a row that doesn't yield a description, quantity and unit price is
 * skipped rather than guessed at, and a page with no recognizable items table returns an empty
 * item list — the import flow shows the user exactly what came back before anything is written, so
 * a partial parse is visible rather than silently persisted.
 */
export function parseNfcePage(html: string): ParsedNfce {
  const items = itemRows(html)
    .map(parseItem)
    .filter((item): item is ParsedNfceItem => item !== null);

  const cnpjText = firstMatch(html, /CNPJ:?\s*([\d.\-/]{14,20})/i);
  // The label arrives as "Emiss&atilde;o:</strong> 15/07/2026 ..." — HTML-entity-encoded and with
  // tags between the colon and the value — so the date is captured directly by shape a short way
  // after the label rather than by trying to isolate "the text after the colon".
  const emissionText = firstMatch(html, /Emiss[\s\S]{0,40}?(\d{2}\/\d{2}\/\d{4})/i);

  // "Valor a pagar" is the amount actually charged (after discounts); the plain "Valor total"
  // above it isn't. Anchor on the label so a page that reorders its totals can't hand back the
  // wrong one — null here just means the caller sums the items instead.
  const payableBlock = firstMatch(html, /Valor a pagar[\s\S]{0,200}?<span[^>]*class="[^"]*totalNumb[^"]*"[^>]*>([\s\S]*?)<\/span>/i);

  return {
    storeName: textByClass(html, "txtTopo"),
    storeCnpj: cnpjText ? cnpjText.replace(/\D/g, "") || null : null,
    accessKey: accessKeyFromPage(html),
    purchaseDate: parsePtBrDate(emissionText),
    totalAmount: parsePtBrNumber(payableBlock ? stripTags(payableBlock) : null),
    items,
  };
}
