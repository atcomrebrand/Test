import { extractAccessKey, parseNfcePage } from "./nfce-parser";

const ACCESS_KEY = "35240612345678000199650010000012341000012345";

/** Mirrors SEFAZ-SP's public consulta page: item rows inside table#tabResult, each field in its
 *  own span with a <strong> label glued to the value. */
const PAGE = `
<html><body><div id="conteudo">
  <div class="txtTopo">SUPERMERCADO TESTE LTDA</div>
  <div class="text">CNPJ: 12.345.678/0001-99</div>
  <table id="tabResult">
    <tr id="Item + 1">
      <td class="txtTit2">
        <span class="txtTit">ARROZ TIO JOAO 5KG</span>
        <span class="RCod">(C&oacute;digo: 000123)</span>
        <span class="Rqtd"><strong>Qtde.:</strong>1</span>
        <span class="RUN"><strong>UN: </strong>UN</span>
        <span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;&nbsp;25,90</span>
      </td>
      <td class="txtTit"><span class="valor">25,90</span></td>
    </tr>
    <tr id="Item + 2">
      <td class="txtTit2">
        <span class="txtTit">BANANA PRATA KG</span>
        <span class="RCod">(C&oacute;digo: 000456)</span>
        <span class="Rqtd"><strong>Qtde.:</strong>0,586</span>
        <span class="RUN"><strong>UN: </strong>KG</span>
        <span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;&nbsp;7,9900</span>
      </td>
      <td class="txtTit"><span class="valor">4,68</span></td>
    </tr>
  </table>
  <div id="totalNota">
    <div id="linhaTotal">Valor total R$:<span class="totalNumb">30,58</span></div>
    <div id="linhaTotal">Descontos R$:<span class="totalNumb">0,58</span></div>
    <div id="linhaTotal">Valor a pagar R$:<span class="totalNumb txtMax">30,00</span></div>
  </div>
  <span class="chave">3524 0612 3456 7800 0199 6500 1000 0012 3410 0001 2345</span>
  <li><strong>Emiss&atilde;o:</strong> 15/07/2026 18:32:11 - Via Consumidor</li>
</div></body></html>`;

describe("extractAccessKey", () => {
  it("pulls the key out of an NFC-e QR code URL (first pipe-separated field of ?p=)", () => {
    const url = `https://www.nfce.fazenda.sp.gov.br/qrcode?p=${ACCESS_KEY}|2|1|1|A1B2C3D4E5`;
    expect(extractAccessKey(url)).toBe(ACCESS_KEY);
  });

  it("accepts a bare key, with or without the spacing the nota prints", () => {
    expect(extractAccessKey(ACCESS_KEY)).toBe(ACCESS_KEY);
    expect(extractAccessKey("3524 0612 3456 7800 0199 6500 1000 0012 3410 0001 2345")).toBe(ACCESS_KEY);
  });

  it("returns null for input carrying no 44-digit key, instead of salvaging digits", () => {
    expect(extractAccessKey("https://exemplo.com/qualquer-coisa")).toBeNull();
    expect(extractAccessKey("12345")).toBeNull();
    // A shorter and a longer run must both be rejected outright.
    expect(extractAccessKey("1".repeat(43))).toBeNull();
    expect(extractAccessKey("1".repeat(45))).toBeNull();
  });
});

describe("parseNfcePage", () => {
  it("extracts the store, CNPJ, access key, date and payable total", () => {
    const parsed = parseNfcePage(PAGE);
    expect(parsed.storeName).toBe("SUPERMERCADO TESTE LTDA");
    expect(parsed.storeCnpj).toBe("12345678000199");
    expect(parsed.accessKey).toBe(ACCESS_KEY);
    expect(parsed.purchaseDate).toBe("2026-07-15");
  });

  it('reads "Valor a pagar" rather than the gross total printed above it', () => {
    expect(parseNfcePage(PAGE).totalAmount).toBe(30);
  });

  it("parses a whole-unit item", () => {
    const [arroz] = parseNfcePage(PAGE).items;
    expect(arroz).toEqual({
      description: "ARROZ TIO JOAO 5KG",
      storeCode: "000123",
      quantity: 1,
      unit: "UN",
      unitPrice: 25.9,
      totalPrice: 25.9,
    });
  });

  it("parses a fractional-weight item without losing precision on the quantity or unit price", () => {
    const banana = parseNfcePage(PAGE).items[1];
    expect(banana.quantity).toBe(0.586);
    expect(banana.unit).toBe("KG");
    expect(banana.unitPrice).toBe(7.99);
    expect(banana.totalPrice).toBe(4.68);
  });

  it("derives a missing line total from quantity x unit price", () => {
    const page = PAGE.replace('<td class="txtTit"><span class="valor">25,90</span></td>', "<td></td>");
    const [arroz] = parseNfcePage(page).items;
    expect(arroz.totalPrice).toBe(25.9);
  });

  it("skips rows missing the fields an item needs, keeping the valid ones", () => {
    const page = PAGE.replace('<span class="Rqtd"><strong>Qtde.:</strong>1</span>', "");
    const parsed = parseNfcePage(page);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].description).toBe("BANANA PRATA KG");
  });

  it("returns no items (rather than throwing) when the page has no recognizable items table", () => {
    const parsed = parseNfcePage("<html><body><p>Nota não encontrada</p></body></html>");
    expect(parsed.items).toEqual([]);
    expect(parsed.accessKey).toBeNull();
  });

  it("does not invent an access key by splicing unrelated numbers on the page together", () => {
    const page = PAGE.replace(/<span class="chave">[\s\S]*?<\/span>/, "");
    expect(parseNfcePage(page).accessKey).toBeNull();
  });
});
