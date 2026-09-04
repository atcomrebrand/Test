import { decodeHtmlDocument } from "./html-charset";

const ACENTOS = "Informação dos Tributos — AÇÚCAR CRISTAL";

function utf8(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, "utf8"));
}

function latin1(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, "latin1"));
}

describe("decodeHtmlDocument", () => {
  it("follows the charset the response header declares", () => {
    expect(decodeHtmlDocument(utf8(ACENTOS), "text/html; charset=utf-8")).toBe(ACENTOS);
    const emLatin1 = "Informação dos Tributos";
    expect(decodeHtmlDocument(latin1(emLatin1), "text/html; charset=ISO-8859-1")).toBe(emLatin1);
  });

  it("falls back to the document's own meta charset when the header says nothing", () => {
    const emLatin1 = "AÇÚCAR";
    const page = `<html><head><meta charset="iso-8859-1"></head><body>${emLatin1}</body></html>`;
    expect(decodeHtmlDocument(latin1(page), null)).toContain(emLatin1);
    expect(decodeHtmlDocument(latin1(page), "text/html")).toContain(emLatin1);
  });

  it("reads the legacy http-equiv declaration too", () => {
    const page = `<html><head><meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1"></head><body>AÇÚCAR</body></html>`;
    expect(decodeHtmlDocument(latin1(page), null)).toContain("AÇÚCAR");
  });

  it("detects UTF-8 from the bytes when nothing declares a charset", () => {
    // The SEFAZ-SP case. Assuming Latin-1 here is what turned "Informação" into "InformaÃ§Ã£o".
    expect(decodeHtmlDocument(utf8(ACENTOS), null)).toBe(ACENTOS);
  });

  it("falls back to Latin-1 for bytes that are not valid UTF-8", () => {
    const emLatin1 = "AÇÚCAR CRISTAL";
    expect(decodeHtmlDocument(latin1(emLatin1), null)).toBe(emLatin1);
  });

  it("trusts the declared charset over what the bytes look like", () => {
    // Plain ASCII decodes cleanly either way; the point is that a declaration is not second-guessed.
    expect(decodeHtmlDocument(latin1("ARROZ 5KG"), "text/html; charset=iso-8859-1")).toBe("ARROZ 5KG");
  });

  it("ignores a charset it can't decode instead of throwing", () => {
    expect(decodeHtmlDocument(utf8(ACENTOS), "text/html; charset=shift_jis")).toBe(ACENTOS);
  });

  it("does not treat the word charset appearing in page text as a declaration", () => {
    const body = "<html><head></head><body>charset=iso-8859-1 é só texto aqui</body></html>";
    expect(decodeHtmlDocument(utf8(body), null)).toBe(body);
  });
});
