import { MAX_PHOTO_BYTES, base64ByteLength, parseAssetPhoto } from "./asset-photo";

/** Gera um data URL com um payload base64 de exatamente `bytes` bytes decodificados. */
function photoOfSize(bytes: number, mime = "image/jpeg") {
  return `data:${mime};base64,${Buffer.alloc(bytes, 1).toString("base64")}`;
}

describe("base64ByteLength", () => {
  it("conta os bytes decodificados descontando o padding", () => {
    expect(base64ByteLength(Buffer.alloc(1).toString("base64"))).toBe(1); // "AA=="
    expect(base64ByteLength(Buffer.alloc(2).toString("base64"))).toBe(2); // "AAA="
    expect(base64ByteLength(Buffer.alloc(3).toString("base64"))).toBe(3); // "AAAA"
  });
});

describe("parseAssetPhoto", () => {
  it("aceita JPEG, PNG e WebP", () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
      const result = parseAssetPhoto(photoOfSize(1024, mime));
      expect(result.ok).toBe(true);
    }
  });

  it("devolve o tamanho decodificado junto", () => {
    const result = parseAssetPhoto(photoOfSize(2048));
    expect(result).toMatchObject({ ok: true, bytes: 2048 });
  });

  /** SVG é documento que executa script, não bitmap — e a foto volta pra tela dentro de um
   *  `<img src>`. Fica de fora mesmo sendo "imagem". */
  it("recusa SVG e qualquer tipo que não seja bitmap de imagem", () => {
    expect(parseAssetPhoto(photoOfSize(100, "image/svg+xml"))).toMatchObject({ ok: false });
    expect(parseAssetPhoto(photoOfSize(100, "text/html"))).toMatchObject({ ok: false });
    expect(parseAssetPhoto(photoOfSize(100, "application/pdf"))).toMatchObject({ ok: false });
  });

  it("recusa qualquer coisa que não seja data URL base64", () => {
    expect(parseAssetPhoto("https://exemplo.com/carro.jpg")).toMatchObject({ ok: false });
    expect(parseAssetPhoto("data:image/jpeg,nao-e-base64")).toMatchObject({ ok: false });
    expect(parseAssetPhoto("")).toMatchObject({ ok: false });
  });

  /**
   * O redimensionamento no cliente é conveniência, não garantia: quem chama a API direto pode
   * mandar o arquivo original inteiro. O limite tem que morar no servidor.
   */
  it("recusa foto acima do limite", () => {
    const result = parseAssetPhoto(photoOfSize(MAX_PHOTO_BYTES + 1));

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/limite/);
  });

  it("aceita exatamente no limite", () => {
    expect(parseAssetPhoto(photoOfSize(MAX_PHOTO_BYTES))).toMatchObject({ ok: true });
  });

  it("recusa imagem vazia", () => {
    expect(parseAssetPhoto("data:image/jpeg;base64,")).toMatchObject({ ok: false });
  });

  it("recusa base64 truncado", () => {
    expect(parseAssetPhoto("data:image/jpeg;base64,AAAAA")).toMatchObject({ ok: false });
  });

  it("ignora espaço em volta", () => {
    expect(parseAssetPhoto(`  ${photoOfSize(512)}  `)).toMatchObject({ ok: true });
  });
});
