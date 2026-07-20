export type AssetClass = "STOCK" | "FII" | "CRYPTO";
export type TransactionType = "BUY" | "SELL";
export type AssetIncomeType = "DIVIDENDO" | "JCP" | "RENDIMENTO" | "STAKING" | "OUTRO";

export interface CatalogEntry {
  ticker: string;
  name: string;
  type?: string;
  logoUrl?: string;
}

export interface StakingEstimate {
  apyPercent: number;
  sinceDate: string;
  daysHeld: number;
  estimatedYield: number;
  estimatedValue: number;
}

export interface InvestmentTransaction {
  id: string;
  assetId: string;
  type: TransactionType;
  quantity: string;
  unitPrice: string;
  fees: string;
  transactionDate: string;
  notes: string | null;
}

export interface InvestmentIncomeRow {
  id: string;
  type: string;
  amount: string;
  paymentDate: string;
  notes: string | null;
}

export interface Position {
  quantity: number;
  averagePrice: number;
  investedAmount: number;
  realizedProfit: number;
}

export interface InvestmentAsset {
  id: string;
  class: AssetClass;
  ticker: string;
  name: string | null;
  broker: string | null;
  wallet: string | null;
  network: string | null;
  notes: string | null;
  createdAt: string;
  stakingApyPercent: string | null;
  favorite: boolean;
  position: Position;
  currentPrice: number | null;
  /** True when currentPrice/currentValue/profit are based on a substitute price (e.g. a B3
   *  fractional-lot ticker priced via its round-lot counterpart), not an exact quote. */
  priceIsApproximate: boolean;
  currentValue: number | null;
  profit: number | null;
  profitPercent: number | null;
  dividendsReceived: number;
  dividendYield: number | null;
  staking: StakingEstimate | null;
  transactions?: InvestmentTransaction[];
  incomeHistory?: InvestmentIncomeRow[];
}

export interface HistoricalPricePoint {
  date: string;
  close: number;
}

export type ChartRange = "3M" | "6M" | "12M" | "MAX" | "CUSTOM";

export interface ChartRangeParams {
  range: ChartRange;
  /** ISO date (YYYY-MM-DD). Required when range === "CUSTOM". */
  from?: string;
  to?: string;
}

export type AssetFundamentals = Record<string, number | string | null>;

export interface AssetQuoteDetail {
  price: number;
  currency: string;
  changePercent: number | null;
  history: HistoricalPricePoint[];
  fundamentals: AssetFundamentals;
  fetchedAt: string;
  /** True when this price substitutes for an instrument that can't be priced directly (e.g. a B3
   *  fractional-lot ticker priced via its round-lot counterpart) — never treat it as exact. */
  approximate: boolean;
}

export interface AssetQuoteDetailResponse {
  ticker: string;
  class: AssetClass;
  name: string | null;
  detail: AssetQuoteDetail | null;
}

export interface MarketQuoteDetailResponse {
  ticker: string;
  class: AssetClass;
  detail: AssetQuoteDetail | null;
  ownedAssetId: string | null;
}

export interface NewsArticle {
  title: string;
  link: string;
  source: string | null;
  publishedAt: string;
  description: string | null;
}

export interface ArticlePreview {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  siteName: string | null;
  url: string;
}

export type DividendType = "DIVIDENDO" | "JCP" | "OUTRO";

export interface DividendCalendarEntry {
  ticker: string;
  name: string | null;
  type: DividendType;
  rate: number;
  exDate: string | null;
  paymentDate: string | null;
  relatedTo: string | null;
  quantityHeld: number | null;
  estimatedAmount: number | null;
}

export type FixedIncomeType = "CDB" | "LCI" | "LCA" | "TESOURO" | "OUTRO";
export type FixedIncomeLiquidity = "DIARIA" | "NO_VENCIMENTO" | "OUTRO";
export type FixedIncomeIndexer = "PREFIXADO" | "POS_FIXADO_CDI" | "IPCA_MAIS" | "OUTRO";

export interface FixedIncomeCalculation {
  daysElapsed: number;
  grossValue: number;
  grossYield: number;
  iofRate: number;
  iofAmount: number;
  irRate: number;
  irAmount: number;
  netYield: number;
  netValue: number;
  grossProfitabilityPercent: number;
  netProfitabilityPercent: number;
}

export interface InvestmentFixedIncome {
  id: string;
  institution: string;
  type: FixedIncomeType;
  principalAmount: string;
  applicationDate: string;
  maturityDate: string;
  liquidity: FixedIncomeLiquidity;
  indexer: FixedIncomeIndexer;
  fixedRatePercent: string | null;
  cdiPercent: string | null;
  redeemedAt: string | null;
  redeemedNetAmount: string | null;
  notes: string | null;
  calculation: FixedIncomeCalculation;
  incomeHistory?: InvestmentIncomeRow[];
}

export interface CashAccount {
  id: string;
  name: string;
  institution: string | null;
  balance: string;
  notes: string | null;
}

export interface DashboardCards {
  patrimonioTotal: number;
  valorInvestido: number;
  valorAtual: number;
  lucroLiquido: number;
  rentabilidadePercent: number;
  dividendosRecebidos: number;
  jurosRecebidos: number;
  aportesDoMes: number;
}

export interface DashboardSummary {
  cards: DashboardCards;
  distribuicaoPorCategoria: { category: string; total: number }[];
  distribuicaoPorAtivo: { label: string; class: string; value: number }[];
  topGanhos: { label: string; class: string; profit: number; profitPercent: number }[];
  topPerdas: { label: string; class: string; profit: number; profitPercent: number }[];
  proximosVencimentos: { id: string; institution: string; type: string; maturityDate: string; netValue: number }[];
  ultimosLancamentos: { id: string; entity: string; action: string; changes: unknown; createdAt: string }[];
  evolucaoPatrimonial: { series: { month: string; capitalInvestido: number }[]; currentPatrimony: number };
}
