/** Abbreviations supermarkets use interchangeably for the same word — normalizing them is what
 *  lets "ARROZ TIO JOÃO 5KG" and "ARROZ T JOAO 5 KG" collapse onto one product. Kept small and
 *  conservative on purpose: an over-eager list would merge genuinely different products, which is
 *  far worse than leaving two rows the user can look at and understand. */
const ABBREVIATIONS: Record<string, string> = {
  KILO: "KG",
  KGS: "KG",
  LITRO: "L",
  LITROS: "L",
  LT: "L",
  LTS: "L",
  ML: "ML",
  GR: "G",
  GRS: "G",
  GRAMAS: "G",
  UND: "UN",
  UNID: "UN",
  UNIDADE: "UN",
  PCT: "PACOTE",
  PC: "PACOTE",
  CX: "CAIXA",
  SACHE: "SACHE",
  REFRIG: "REFRIGERANTE",
  INT: "INTEGRAL",
  DESN: "DESNATADO",
  TRAD: "TRADICIONAL",
};

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Builds the key that decides whether two nota lines are the same product for price-history
 * purposes. The store's own product code can't be used for this — it's internal to each
 * supermarket, so the identical item carries different codes at different stores — so grouping
 * falls back to the printed description, normalized: accents stripped, case folded, punctuation
 * dropped, common abbreviations expanded, and digits kept glued to their unit ("5 KG" → "5KG") so
 * pack size still distinguishes a 1kg bag from a 5kg one.
 *
 * Deliberately imperfect and knowingly so: two spellings that differ by more than this will show
 * up as two products rather than being force-merged on a guess. Splitting one product in two is a
 * visible, correctable annoyance; silently merging two different products corrupts the price
 * history in a way the user would have no way to notice.
 */
export function marketProductKey(description: string): string {
  const words = stripAccents(description)
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word !== "")
    // "1LT" has to come apart before the abbreviation table can see the "LT" — the glue pass
    // below puts it back together as "1L" once the unit is normalized.
    .flatMap((word) => {
      const numberUnit = word.match(/^(\d+)([A-Z]+)$/);
      return numberUnit ? [numberUnit[1], numberUnit[2]] : [word];
    })
    .map((word) => ABBREVIATIONS[word] ?? word);

  // Re-glue a bare number onto the unit that follows it, so "5 KG" and "5KG" produce one key.
  const glued: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const current = words[i];
    const next = words[i + 1];
    if (/^\d+$/.test(current) && next && /^(KG|G|L|ML|UN|PACOTE|CAIXA)$/.test(next)) {
      glued.push(`${current}${next}`);
      i++;
      continue;
    }
    glued.push(current);
  }

  return glued.join(" ");
}
