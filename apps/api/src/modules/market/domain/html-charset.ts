/** Charsets a Brazilian government portal realistically serves, mapped to what Node can decode. */
function nodeEncoding(charset: string | null): "utf8" | "latin1" | null {
  const name = charset?.trim().toLowerCase().replace(/^"|"$/g, "");
  if (!name) return null;
  if (name === "utf-8" || name === "utf8") return "utf8";
  // windows-1252 differs from latin1 only in 0x80–0x9F, which holds smart quotes and dashes — close
  // enough for reading a nota, and Node offers no cp1252 decoder anyway.
  if (name === "iso-8859-1" || name === "latin1" || name === "windows-1252" || name === "cp1252") return "latin1";
  return null;
}

function charsetFromContentType(contentType: string | null): string | null {
  return contentType?.match(/charset\s*=\s*([^;\s]+)/i)?.[1] ?? null;
}

/** Reads the document's own declaration, in either the HTML5 or the legacy http-equiv form. Only
 *  the head is searched: a later "charset=" inside page text is not a declaration. */
function charsetFromMeta(head: string): string | null {
  return head.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i)?.[1] ?? null;
}

function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

/**
 * Decodes a fetched HTML document to text using the charset it actually came in.
 *
 * Node's `fetch().text()` decodes as UTF-8 no matter what the document says, which mangles accented
 * text on the Latin-1 portals this codebase reads (Fundamentus). Hardcoding latin1 instead just
 * moves the bug: SEFAZ-SP serves UTF-8, and decoding *that* as latin1 turns every "ç" into "Ã§" —
 * which is exactly what happened here before this function existed. So the charset is read rather
 * than assumed: the response header first, then the document's own <meta>, and only then a guess.
 *
 * The guess is safe in one direction. Multi-byte UTF-8 sequences are a strict, self-checking shape,
 * and Latin-1 text made of independently-chosen accented bytes essentially never forms a valid one
 * by accident — so "decodes cleanly as UTF-8" means it is UTF-8, and a decode failure means it
 * isn't. Latin-1 is the fallback because it never fails, mapping every byte to a character.
 */
export function decodeHtmlDocument(bytes: Uint8Array, contentType: string | null): string {
  const declared = nodeEncoding(charsetFromContentType(contentType)) ?? nodeEncoding(charsetFromMeta(Buffer.from(bytes.subarray(0, 4096)).toString("latin1")));
  const encoding = declared ?? (isValidUtf8(bytes) ? "utf8" : "latin1");
  return Buffer.from(bytes).toString(encoding);
}
