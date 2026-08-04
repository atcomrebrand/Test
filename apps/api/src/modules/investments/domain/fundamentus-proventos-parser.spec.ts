import { parseFundamentusProventos } from "./fundamentus-proventos-parser";

/** Mirrors the stock proventos.php table: Data | Valor | Tipo | Data de Pagamento | Por quantas ações. */
const STOCK_HTML = `
<html><body>
<table id="resultado" class="w728">
  <thead><tr>
    <th>Data</th><th>Valor</th><th>Tipo</th><th>Data de Pagamento</th><th>Por quantas ações</th>
  </tr></thead>
  <tbody>
    <tr><td>02/06/2026</td><td>0,25</td><td>DIVIDENDO</td><td>01/07/2026</td><td>1</td></tr>
    <tr><td>15/05/2026</td><td>0,092</td><td>JRS CAP PROPRIO</td><td>-</td><td>1</td></tr>
    <tr><td>10/03/1998</td><td>50,00</td><td>DIVIDENDO</td><td>30/04/1998</td><td>1000</td></tr>
  </tbody>
</table>
</body></html>`;

/** Mirrors the FII table variant: Última Data Com | Tipo | Data de Pagamento | Valor. */
const FII_HTML = `
<table id="resultado">
  <tr><th>Última Data Com</th><th>Tipo</th><th>Data de Pagamento</th><th>Valor</th></tr>
  <tr><td>31/07/2026</td><td>RENDIMENTO</td><td>14/08/2026</td><td>0,10</td></tr>
  <tr><td>30/06/2026</td><td>AMORTIZAÇÃO</td><td>15/07/2026</td><td>0,05</td></tr>
</table>`;

describe("parseFundamentusProventos", () => {
  it("parses the stock table variant, converting dates and pt-BR decimals", () => {
    const events = parseFundamentusProventos(STOCK_HTML, "ITSA4");
    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({
      ticker: "ITSA4",
      type: "DIVIDENDO",
      rate: 0.25,
      exDate: "2026-06-02",
      paymentDate: "2026-07-01",
      relatedTo: null,
    });
  });

  it('maps "JRS CAP PROPRIO" to JCP and an unannounced payment date ("-") to null', () => {
    const events = parseFundamentusProventos(STOCK_HTML, "ITSA4");
    expect(events[1].type).toBe("JCP");
    expect(events[1].paymentDate).toBeNull();
  });

  it('divides the value by "Por quantas ações" to get a per-share rate', () => {
    const events = parseFundamentusProventos(STOCK_HTML, "ITSA4");
    expect(events[2].rate).toBeCloseTo(0.05, 10);
  });

  it("parses the FII table variant by header name, mapping RENDIMENTO to DIVIDENDO", () => {
    const events = parseFundamentusProventos(FII_HTML, "MXRF11");
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      ticker: "MXRF11",
      type: "DIVIDENDO",
      rate: 0.1,
      exDate: "2026-07-31",
      paymentDate: "2026-08-14",
      relatedTo: null,
    });
    expect(events[1].type).toBe("OUTRO");
  });

  it("returns [] when the resultado table is missing entirely", () => {
    expect(parseFundamentusProventos("<html><body><p>Nenhum provento encontrado</p></body></html>", "XXXX3")).toEqual([]);
  });

  it("returns [] when headers don't match any known variant, rather than guessing columns", () => {
    const html = `<table id="resultado"><tr><th>Coluna A</th><th>Coluna B</th></tr><tr><td>01/01/2026</td><td>0,10</td></tr></table>`;
    expect(parseFundamentusProventos(html, "ITSA4")).toEqual([]);
  });

  it("skips malformed rows without dropping the valid ones around them", () => {
    const html = `
<table id="resultado">
  <tr><th>Data</th><th>Valor</th><th>Tipo</th><th>Data de Pagamento</th><th>Por quantas ações</th></tr>
  <tr><td>invalid</td><td>0,25</td><td>DIVIDENDO</td><td>01/07/2026</td><td>1</td></tr>
  <tr><td>02/06/2026</td><td>-</td><td>DIVIDENDO</td><td>01/07/2026</td><td>1</td></tr>
  <tr><td>03/06/2026</td><td>0,30</td><td>DIVIDENDO</td><td>10/07/2026</td><td>1</td></tr>
</table>`;
    const events = parseFundamentusProventos(html, "ITSA4");
    expect(events).toHaveLength(1);
    expect(events[0].exDate).toBe("2026-06-03");
  });

  it("survives links/markup inside cells (Fundamentus wraps some values in spans/links)", () => {
    const html = `
<table id="resultado">
  <tr><th>Data</th><th>Valor</th><th>Tipo</th><th>Data de Pagamento</th><th>Por quantas ações</th></tr>
  <tr><td><a href="#">02/06/2026</a></td><td><span>0,25</span></td><td>DIVIDENDO</td><td>01/07/2026</td><td>1</td></tr>
</table>`;
    const events = parseFundamentusProventos(html, "ITSA4");
    expect(events).toHaveLength(1);
    expect(events[0].rate).toBe(0.25);
  });
});
