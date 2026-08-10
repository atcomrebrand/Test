/**
 * Validação da foto do bem financiado.
 *
 * A foto chega como data URL já redimensionada pelo cliente. O cliente é conveniência, não
 * garantia — quem chama a API pode mandar o que quiser —, então o limite de tamanho e a lista de
 * tipos aceitos moram aqui: sem isso, um POST direto encheria a coluna com um arquivo de 10 MB ou
 * com `data:text/html` (que voltaria pra tela dentro de um `<img src>`).
 */

/** Só formatos de imagem que o navegador renderiza em `<img>`. SVG fica de fora de propósito:
 *  é um documento que executa script, não um bitmap. */
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** O cliente manda um quadrado de ~320px em JPEG (~25 KB). 600 KB dá folga larga pra variação de
 *  qualidade sem virar porta de entrada pra despejar arquivo grande no banco. */
export const MAX_PHOTO_BYTES = 600 * 1024;

const DATA_URL_PATTERN = /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/]+={0,2})$/i;

export type AssetPhotoResult = { ok: true; dataUrl: string; bytes: number } | { ok: false; reason: string };

/** Quantos bytes o payload base64 vira depois de decodificado — sem alocar o buffer. */
export function base64ByteLength(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return (base64.length * 3) / 4 - padding;
}

export function parseAssetPhoto(input: string): AssetPhotoResult {
  const dataUrl = input.trim();

  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    return { ok: false, reason: "A foto precisa ser um data URL base64 (ex.: data:image/jpeg;base64,...)." };
  }

  const [, mimeType, base64] = match;
  if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
    return { ok: false, reason: `Formato ${mimeType} não é aceito. Use JPEG, PNG ou WebP.` };
  }

  // base64 válido vem em blocos de 4; comprimento fora disso é payload truncado.
  if (base64.length % 4 !== 0) {
    return { ok: false, reason: "A imagem parece incompleta ou corrompida." };
  }

  const bytes = base64ByteLength(base64);
  if (bytes === 0) return { ok: false, reason: "A imagem está vazia." };
  if (bytes > MAX_PHOTO_BYTES) {
    return { ok: false, reason: `A foto tem ${Math.round(bytes / 1024)} KB — o limite é ${MAX_PHOTO_BYTES / 1024} KB.` };
  }

  return { ok: true, dataUrl, bytes };
}
