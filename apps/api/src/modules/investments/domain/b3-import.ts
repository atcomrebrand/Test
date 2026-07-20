/**
 * Pure parsing/classification logic for B3's two "Área do Investidor" exports:
 *  - "Negociação" (trade blotter): every Compra/Venda, by trade date.
 *  - "Movimentação" (extrato/ledger): everything else — dividends, JCP, rendimentos, bonus
 *    shares, fractional-lot auctions, and a lot of custody noise (transfers, settlement,
 *    subscription rights) that either duplicates Negociação or has no cash/position impact.
 *
 * Critically, "Transferência - Liquidação" in Movimentação is the D+2 settlement leg of the
 * SAME trades already present in Negociação — importing both would double-count every buy/sell.
 * This module always treats Negociação as the source of truth for transactions and only pulls
 * income/corporate-action rows out of Movimentação.
 */

export interface B3NegociacaoRow {
  dataNegocio: unknown;
  tipoMovimentacao: unknown;
  mercado: unknown;
  prazoVencimento?: unknown;
  instituicao?: unknown;
  codigoNegociacao: unknown;
  quantidade: unknown;
  preco: unknown;
  valor?: unknown;
}

export interface B3MovimentacaoRow {
  entradaSaida?: unknown;
  data: unknown;
  movimentacao: unknown;
  produto: unknown;
  instituicao?: unknown;
  quantidade: unknown;
  precoUnitario?: unknown;
  valorOperacao?: unknown;
}

export type ImportAssetClass = "STOCK" | "FII";
export type ImportIncomeType = "DIVIDENDO" | "JCP" | "RENDIMENTO" | "OUTRO";

export interface ImportedTransaction {
  ticker: string;
  assetClass: ImportAssetClass;
  assetName: string | null;
  type: "BUY" | "SELL";
  quantity: number;
  unitPrice: number;
  transactionDate: string;
  sourceLabel: string;
}

export interface ImportedIncome {
  ticker: string;
  assetClass: ImportAssetClass;
  assetName: string | null;
  type: ImportIncomeType;
  amount: number;
  paymentDate: string;
  sourceLabel: string;
}

export interface SkippedRow {
  source: "negociacao" | "movimentacao";
  description: string;
  reason: string;
}

export interface B3ImportPlan {
  transactions: ImportedTransaction[];
  incomes: ImportedIncome[];
  skipped: SkippedRow[];
}

/** Movement types with no cash/position impact for our ledger, or that duplicate a Negociação
 *  trade — always skipped regardless of whether the row happens to carry a value. */
const IGNORED_MOVEMENT_TYPES = new Set([
  "Transferência",
  "Transferência - Liquidação",
  "Direito de Subscrição",
  "Direitos de Subscrição - Não Exercido",
  "Cessão de Direitos - Solicitada",
  "Atualização",
  "Fração em Ativos",
]);

const INCOME_TYPE_BY_MOVEMENT: Record<string, ImportIncomeType> = {
  Dividendo: "DIVIDENDO",
  "Juros Sobre Capital Próprio": "JCP",
  Rendimento: "RENDIMENTO",
  "Rendimento - Transferido": "RENDIMENTO",
  Reembolso: "OUTRO",
};

const FRACTIONAL_TICKER_PATTERN = /^([A-Z]{4}\d{1,2})F$/;

export function baseTickerForFractional(ticker: string): string | null {
  return ticker.toUpperCase().match(FRACTIONAL_TICKER_PATTERN)?.[1] ?? null;
}

export function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim().replace(",", ".");
    if (trimmed === "" || trimmed === "-") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** B3 exports dates as plain "dd/mm/yyyy" text. Defensively also accepts an ISO string (in case
 *  a client-side spreadsheet reader already converted it), returning null for anything else so
 *  the caller can skip the row instead of crashing on a malformed date. */
export function parseBrDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();

  const brMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/** Splits B3's "TICKER - Full Company Name" product field. */
export function parseProductField(produto: string): { ticker: string; name: string } {
  const [tickerPart, ...rest] = produto.split(" - ");
  return { ticker: tickerPart.trim().toUpperCase(), name: rest.join(" - ").trim() };
}

/** FIIs are identified by their descriptive name (fund names always say so), not just the "11"
 *  ticker suffix — several non-FII "units" (e.g. SAPR11, TAEE11) also end in 11. */
export function inferAssetClass(name: string, ticker: string): ImportAssetClass {
  const upper = name.toUpperCase();
  if (upper.includes("FII") || upper.includes("FDO INV IMOB") || upper.includes("FUNDO DE INVESTIMENTO IMOBILI") || upper.includes("FUNDO IMOBILI")) {
    return "FII";
  }
  if (!name && /^[A-Z]{4}11B?$/.test(ticker)) return "FII";
  return "STOCK";
}

interface AssetInfo {
  name: string | null;
  assetClass: ImportAssetClass;
}

function buildAssetInfoMap(movimentacao: B3MovimentacaoRow[]): Map<string, AssetInfo> {
  const map = new Map<string, AssetInfo>();
  for (const row of movimentacao) {
    if (typeof row.produto !== "string" || !row.produto.trim()) continue;
    const { ticker, name } = parseProductField(row.produto);
    if (!map.has(ticker) && name) {
      map.set(ticker, { name, assetClass: inferAssetClass(name, ticker) });
    }
  }
  return map;
}

function lookupAssetInfo(ticker: string, map: Map<string, AssetInfo>): AssetInfo {
  const lookupKey = baseTickerForFractional(ticker) ?? ticker;
  return map.get(lookupKey) ?? { name: null, assetClass: inferAssetClass("", ticker) };
}

function parseNegociacaoRows(rows: B3NegociacaoRow[], assetInfoMap: Map<string, AssetInfo>): { transactions: ImportedTransaction[]; skipped: SkippedRow[]; tickers: Set<string> } {
  const transactions: ImportedTransaction[] = [];
  const skipped: SkippedRow[] = [];
  const tickers = new Set<string>();

  for (const row of rows) {
    const tipo = typeof row.tipoMovimentacao === "string" ? row.tipoMovimentacao.trim() : "";
    const ticker = typeof row.codigoNegociacao === "string" ? row.codigoNegociacao.trim().toUpperCase() : "";
    const quantity = toNumberOrNull(row.quantidade);
    const unitPrice = toNumberOrNull(row.preco);
    const transactionDate = parseBrDate(row.dataNegocio);
    const description = `${row.dataNegocio} ${tipo} ${ticker}`.trim();

    if (tipo !== "Compra" && tipo !== "Venda") {
      skipped.push({ source: "negociacao", description, reason: `Tipo de movimentação não reconhecido: "${tipo || "vazio"}"` });
      continue;
    }
    if (!ticker) {
      skipped.push({ source: "negociacao", description, reason: "Código de negociação vazio" });
      continue;
    }
    if (quantity === null || quantity <= 0) {
      skipped.push({ source: "negociacao", description, reason: "Quantidade inválida" });
      continue;
    }
    if (unitPrice === null || unitPrice <= 0) {
      skipped.push({ source: "negociacao", description, reason: "Preço inválido" });
      continue;
    }
    if (!transactionDate) {
      skipped.push({ source: "negociacao", description, reason: "Data do negócio inválida" });
      continue;
    }

    const info = lookupAssetInfo(ticker, assetInfoMap);
    const mercado = typeof row.mercado === "string" ? row.mercado : "";
    tickers.add(ticker);
    transactions.push({
      ticker,
      assetClass: info.assetClass,
      assetName: info.name,
      type: tipo === "Compra" ? "BUY" : "SELL",
      quantity,
      unitPrice,
      transactionDate,
      sourceLabel: mercado ? `${tipo} - ${mercado}` : tipo,
    });
  }

  return { transactions, skipped, tickers };
}

/** Dividends/JCP/rendimentos are always reported in Movimentação against the round-lot ticker,
 *  even when the user's actual position is fractional-only — this redirects the income to
 *  whichever variant the user's Negociação trades actually show, so it lands on a real position
 *  instead of silently creating a phantom zero-quantity asset. */
function resolveIncomeTicker(baseTicker: string, txTickers: Set<string>): string {
  if (txTickers.has(baseTicker)) return baseTicker;
  const fractional = `${baseTicker}F`;
  if (txTickers.has(fractional)) return fractional;
  return baseTicker;
}

function parseMovimentacaoRows(rows: B3MovimentacaoRow[], assetInfoMap: Map<string, AssetInfo>, txTickers: Set<string>): { transactions: ImportedTransaction[]; incomes: ImportedIncome[]; skipped: SkippedRow[] } {
  const transactions: ImportedTransaction[] = [];
  const incomes: ImportedIncome[] = [];
  const skipped: SkippedRow[] = [];

  for (const row of rows) {
    const movementType = typeof row.movimentacao === "string" ? row.movimentacao.trim() : "";
    const produto = typeof row.produto === "string" ? row.produto : "";
    const description = `${row.data} ${movementType} ${produto}`.trim();

    if (!produto.trim()) {
      skipped.push({ source: "movimentacao", description, reason: "Produto vazio" });
      continue;
    }

    const { ticker: baseTicker, name } = parseProductField(produto);
    const assetClass = inferAssetClass(name, baseTicker);
    const date = parseBrDate(row.data);
    const value = toNumberOrNull(row.valorOperacao);
    const quantity = toNumberOrNull(row.quantidade);
    const unitPrice = toNumberOrNull(row.precoUnitario);

    if (IGNORED_MOVEMENT_TYPES.has(movementType)) {
      skipped.push({ source: "movimentacao", description, reason: movementLabel(movementType) });
      continue;
    }

    if (!date) {
      skipped.push({ source: "movimentacao", description, reason: "Data inválida" });
      continue;
    }

    const incomeType = INCOME_TYPE_BY_MOVEMENT[movementType];
    if (incomeType) {
      if (value === null || value <= 0) {
        skipped.push({ source: "movimentacao", description, reason: "Sem valor financeiro informado" });
        continue;
      }
      incomes.push({
        ticker: resolveIncomeTicker(baseTicker, txTickers),
        assetClass,
        assetName: name || null,
        type: incomeType,
        amount: value,
        paymentDate: date,
        sourceLabel: movementType,
      });
      continue;
    }

    if (movementType === "Empréstimo") {
      if (value !== null && value > 0) {
        incomes.push({
          ticker: resolveIncomeTicker(baseTicker, txTickers),
          assetClass,
          assetName: name || null,
          type: "OUTRO",
          amount: value,
          paymentDate: date,
          sourceLabel: "Aluguel de ações (BTC)",
        });
      } else {
        skipped.push({ source: "movimentacao", description, reason: "Movimentação de custódia do empréstimo de ações, sem rendimento neste lançamento" });
      }
      continue;
    }

    if (movementType === "Cessão de Direitos") {
      if (value !== null && value > 0) {
        incomes.push({
          ticker: resolveIncomeTicker(baseTicker, txTickers),
          assetClass,
          assetName: name || null,
          type: "OUTRO",
          amount: value,
          paymentDate: date,
          sourceLabel: "Cessão de direitos de subscrição",
        });
      } else {
        skipped.push({ source: "movimentacao", description, reason: "Cessão de direitos sem valor financeiro informado" });
      }
      continue;
    }

    if (movementType === "Leilão de Fração") {
      if (quantity === null || quantity <= 0 || unitPrice === null || unitPrice <= 0) {
        skipped.push({ source: "movimentacao", description, reason: "Leilão de fração sem quantidade/preço válidos" });
        continue;
      }
      transactions.push({
        ticker: baseTicker,
        assetClass,
        assetName: name || null,
        type: "SELL",
        quantity,
        unitPrice,
        transactionDate: date,
        sourceLabel: "Leilão de fração",
      });
      continue;
    }

    if (movementType === "Bonificação em Ativos") {
      if (quantity === null || quantity <= 0) {
        skipped.push({ source: "movimentacao", description, reason: "Bonificação sem quantidade válida" });
        continue;
      }
      transactions.push({
        ticker: baseTicker,
        assetClass,
        assetName: name || null,
        type: "BUY",
        quantity,
        unitPrice: 0,
        transactionDate: date,
        sourceLabel: "Bonificação em ativos",
      });
      continue;
    }

    skipped.push({ source: "movimentacao", description, reason: `Tipo de movimentação não reconhecido: "${movementType || "vazio"}"` });
  }

  return { transactions, incomes, skipped };
}

function movementLabel(movementType: string): string {
  switch (movementType) {
    case "Transferência":
    case "Transferência - Liquidação":
      return "Transferência/liquidação de custódia — já contabilizada como negociação (Compra/Venda)";
    case "Direito de Subscrição":
    case "Direitos de Subscrição - Não Exercido":
      return "Direito de subscrição — sem valor financeiro, não afeta a posição do ativo-base";
    case "Atualização":
      return "Atualização de custódia, sem valor financeiro";
    case "Fração em Ativos":
      return "Debita a fração que foi leiloada — já contabilizada via Leilão de Fração";
    default:
      return "Movimentação sem impacto financeiro/de posição";
  }
}

export function parseB3Import(negociacao: B3NegociacaoRow[], movimentacao: B3MovimentacaoRow[]): B3ImportPlan {
  const assetInfoMap = buildAssetInfoMap(movimentacao);
  const negociacaoResult = parseNegociacaoRows(negociacao, assetInfoMap);
  const movimentacaoResult = parseMovimentacaoRows(movimentacao, assetInfoMap, negociacaoResult.tickers);

  const transactions = [...negociacaoResult.transactions, ...movimentacaoResult.transactions].sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
  const incomes = movimentacaoResult.incomes.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
  const skipped = [...negociacaoResult.skipped, ...movimentacaoResult.skipped];

  return { transactions, incomes, skipped };
}
