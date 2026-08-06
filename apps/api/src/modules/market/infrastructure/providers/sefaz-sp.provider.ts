import { Injectable, Logger } from "@nestjs/common";

/** Same browser UA the other public-portal providers in this codebase send: the consulta page is
 *  public and unauthenticated, but an obviously non-browser client is the usual reason a state
 *  portal serves a stripped page or a block instead of the nota. */
const SEFAZ_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Fetches SEFAZ-SP's public NFC-e consulta page. Two ways in, because a QR scan and a typed key
 * carry different amounts of information:
 *
 * - The full `?p=` payload from the QR code is passed through as-is. It carries the signature
 *   fields (`cHashQRCode` etc.) the portal validates, so it renders the complete nota.
 * - A bare 44-digit key falls back to the key-only consulta form. That path can be answered with a
 *   captcha or a reduced page, which the parser then reports as "no items" — hence the QR route is
 *   always preferred when available.
 *
 * The page is Latin-1, like Fundamentus: Node's fetch always decodes .text() as UTF-8 regardless
 * of the document's own charset, which would mangle every accented product name on the nota.
 * Reading raw bytes and decoding latin1 explicitly avoids that.
 */
@Injectable()
export class SefazSpProvider {
  private readonly logger = new Logger(SefazSpProvider.name);

  async fetchNotaPage(input: { qrPayload?: string; accessKey: string }): Promise<string> {
    const url = input.qrPayload
      ? `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${encodeURIComponent(input.qrPayload)}`
      : `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?chNFe=${input.accessKey}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": SEFAZ_USER_AGENT, Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) throw new Error(`SEFAZ-SP respondeu ${res.status} para a nota ${input.accessKey}`);

    const html = Buffer.from(await res.arrayBuffer()).toString("latin1");
    this.logger.log(`Nota ${input.accessKey} recuperada da SEFAZ-SP (${html.length} bytes)`);
    return html;
  }
}
