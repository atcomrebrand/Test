/**
 * Redimensiona uma foto escolhida pelo usuário pra um quadrado pequeno antes de subir.
 *
 * A foto do bem é exibida numa bolinha de ~44px — subir os 4 MB que a câmera do celular gera pra
 * mostrar isso seria desperdício em todas as pontas (upload no 4G, coluna no banco, backup,
 * payload de toda listagem de financiamento). Um quadrado de 320px em JPEG dá ~25 KB e ainda
 * sobra resolução se um dia a bolinha virar uma foto maior.
 */

/** Lado do quadrado final, em pixels. 320 cobre a bolinha em tela retina com folga. */
const OUTPUT_SIZE = 320;
const JPEG_QUALITY = 0.82;

export class ImageResizeError extends Error {}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // Libera o object URL assim que os pixels já estão na imagem — segurar todos eles até o
      // fim da aba vaza memória em quem troca a foto várias vezes.
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ImageResizeError("Não consegui abrir essa imagem. Tente outro arquivo."));
    };
    img.src = url;
  });
}

/**
 * Recorta no centro (cover) e devolve um data URL JPEG. Cover em vez de encaixar a imagem inteira
 * porque o destino é redondo: sobra branca dentro de um círculo fica pior que cortar as bordas.
 */
export async function resizeImageToSquareDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new ImageResizeError("Escolha um arquivo de imagem.");
  }

  const img = await loadImage(file);

  const side = Math.min(img.naturalWidth, img.naturalHeight);
  if (side === 0) throw new ImageResizeError("Essa imagem parece vazia.");

  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageResizeError("Seu navegador não conseguiu processar a imagem.");

  ctx.imageSmoothingQuality = "high";
  // JPEG não tem transparência: sem esse fundo, PNG transparente vira preto no lugar do vazio.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}
