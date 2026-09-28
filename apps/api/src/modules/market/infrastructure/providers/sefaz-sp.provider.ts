import { Injectable, Logger } from "@nestjs/common";
import { decodeHtmlDocument } from "../../domain/html-charset";

/** Same browser UA the other public-portal providers in this codebase send: the consulta page is
 *  public and unauthenticated, but an obviously non-browser client is the usual reason a state
 *  portal serves a stripped page or a block instead of the nota. */
const SEFAZ_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const CONSULTA_URL = "https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx";

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
 * The bytes are decoded by the charset the response actually declares (see decodeHtmlDocument), not
 * by a fixed one. This started out hardcoded to Latin-1 by analogy with Fundamentus and was wrong:
 * SEFAZ-SP serves UTF-8, so every "ç" in a product name was coming through as "Ã§".
 */
@Injectable()
export class SefazSpProvider {
  private readonly logger = new Logger(SefazSpProvider.name);

  async fetchNotaPage(input: { qrPayload?: string; accessKey: string }): Promise<string> {
    // ConsultaQRCode.aspx with the payload is the exact URL a phone's camera opens when it scans
    // the nota — confirmed against a real 2026-08 SP nota. Going straight there avoids depending on
    // the /qrcode endpoint's redirect behaving the same way for a server-side client.
    const url = input.qrPayload
      ? `${CONSULTA_URL}?p=${encodeURIComponent(input.qrPayload)}`
      : `${CONSULTA_URL}?chNFe=${input.accessKey}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": SEFAZ_USER_AGENT, Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) throw new Error(`SEFAZ-SP respondeu ${res.status} para a nota ${input.accessKey}`);

    const html = decodeHtmlDocument(new Uint8Array(await res.arrayBuffer()), res.headers.get("content-type"));
    this.logger.log(`Nota ${input.accessKey} recuperada da SEFAZ-SP (${html.length} caracteres)`);
    return html;
  }
}
