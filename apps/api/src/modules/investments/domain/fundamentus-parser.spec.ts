import { parseFundamentusIndicators } from "./fundamentus-parser";

/** Mirrors the real cell sequence confirmed against a live fetch of detalhes.php?papel=PETR4
 *  (2026-07-26): "?"+label immediately followed by its value in the next <td>, unrelated cells
 *  (section headers, oscilações) interleaved between them, and "Lucro Líquido" repeated twice
 *  (TTM column first, then last-quarter). */
function buildFixture(overrides: Record<string, string> = {}): string {
  const cell = (text: string) => `<td class="w1"><span class="txt">${text}</span></td>`;
  const withOverride = (label: string, fallback: string) => overrides[label] ?? fallback;

  return `
    <table>
      <tr>${cell("Oscilações")}${cell("Indicadores fundamentalistas")}</tr>
      <tr>${cell("Dia")}${cell("-1,72%")}${cell("?P/L")}${cell(withOverride("P/L", "5,06"))}</tr>
      <tr>${cell("Mês")}${cell("10,67%")}${cell("?Marg. Bruta")}${cell(withOverride("Marg. Bruta", "47,4%"))}</tr>
      <tr>${cell("30 dias")}${cell("7,32%")}${cell("?PSR")}${cell(withOverride("PSR", "1,09"))}</tr>
      <tr>${cell("12 meses")}${cell("41,89%")}${cell("?ROE")}${cell(withOverride("ROE", "24,2%"))}</tr>
      <tr>${cell("2026")}${cell("40,43%")}${cell("?Liquidez Corr")}${cell(withOverride("Liquidez Corr", "0,74")) }</tr>
      <tr>${cell("2025")}${cell("-6,06%")}${cell("?Dív Líq / Patrim")}${cell(withOverride("Dív Líq / Patrim", "0,73"))}</tr>
      <tr>${cell("Dados Balanço Patrimonial")}</tr>
      <tr>${cell("?Ativo")}${cell(withOverride("Ativo", "1.246.070.000.000"))}${cell("?Patrim. Líq")}${cell(withOverride("Patrim. Líq", "445.189.000.000"))}</tr>
      <tr>${cell("Dados demonstrativos de resultados")}</tr>
      <tr>${cell("Últimos 12 meses")}${cell("Últimos 3 meses")}</tr>
      <tr>${cell("?Lucro Líquido")}${cell(withOverride("Lucro Líquido TTM", "107.583.000.000"))}${cell("?Lucro Líquido")}${cell("32.663.000.000")}</tr>
    </table>
  `;
}

describe("parseFundamentusIndicators", () => {
  it("parses every field from a page matching the confirmed PETR4 structure", () => {
    const result = parseFundamentusIndicators(buildFixture());

    expect(result.grossMargin).toBeCloseTo(47.4);
    expect(result.priceToSales).toBeCloseTo(1.09);
    expect(result.returnOnEquity).toBeCloseTo(24.2);
    expect(result.currentRatio).toBeCloseTo(0.74);
    expect(result.netDebtToEquity).toBeCloseTo(0.73);
    expect(result.totalStockholderEquity).toBe(445189000000);
  });

  it("derives totalLiabilities from the Ativo = Passivo + Patrimônio identity", () => {
    const result = parseFundamentusIndicators(buildFixture());
    expect(result.totalLiabilities).toBe(1246070000000 - 445189000000);
  });

  it("derives returnOnAssets from Lucro Líquido TTM over Ativo", () => {
    const result = parseFundamentusIndicators(buildFixture());
    expect(result.returnOnAssets).toBeCloseTo((107583000000 / 1246070000000) * 100);
  });

  it("keeps the first (TTM) Lucro Líquido value, not the repeated quarterly one", () => {
    const result = parseFundamentusIndicators(buildFixture({ "Lucro Líquido TTM": "200.000.000.000" }));
    expect(result.returnOnAssets).toBeCloseTo((200000000000 / 1246070000000) * 100);
  });

  it("returns null for a field whose label is present but the page carries no value at all", () => {
    const html = buildFixture().replace('<td class="w1"><span class="txt">24,2%</span></td>', '<td class="w1"><span class="txt"></span></td>');
    const result = parseFundamentusIndicators(html);
    expect(result.returnOnEquity).toBeNull();
  });

  it("returns nulls throughout for a page with no matching labels at all", () => {
    const result = parseFundamentusIndicators("<table><tr><td>Nada aqui</td></tr></table>");
    expect(result).toEqual({
      grossMargin: null,
      priceToSales: null,
      returnOnEquity: null,
      returnOnAssets: null,
      currentRatio: null,
      netDebtToEquity: null,
      totalStockholderEquity: null,
      totalLiabilities: null,
    });
  });
});
