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
  /** % of the position assumed staked (0-100) — defaults to 100 for configs made before this
   *  field existed. */
  stakingPercent: number;
  /** investedAmount * stakingPercent/100 — the actual base the yield estimate is computed on. */
  stakedAmount: number;
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
  stakingPercent: string | null;
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

// ---------------------------------------------------------------------------
// Análise (Visão Geral / Indicadores / Checklist / Proventos) — stocks/FIIs only
// ---------------------------------------------------------------------------

export type ProfitabilityPeriod = "1M" | "3M" | "1A" | "2A" | "5A" | "10A";

export interface AssetIndicators {
  peRatio: number | null;
  priceToSales: number | null;
  priceToBook: number | null;
  dividendYield: number | null;
  payoutRatio: number | null;
  netMargin: number | null;
  grossMargin: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  netDebtToEquity: number | null;
  currentRatio: number | null;
}

export interface GrahamResult {
  currentPrice: number;
  fairPrice: number;
  upsidePercent: number;
}

export interface BazinResult {
  currentPrice: number;
  ceilingPrice: number;
}

export type ChecklistStatus = "PASS" | "FAIL" | "UNKNOWN";

export interface ChecklistItem {
  id: string;
  label: string;
  status: ChecklistStatus;
}

export interface DividendYearSummary {
  year: number;
  totalPerShare: number;
  yieldPercent: number | null;
}

export interface DividendMonthRadarEntry {
  month: number;
  monthlyPaymentCount: number;
}

export interface PayoutYearEntry {
  year: number;
  netIncome: number;
  payoutPercent: number | null;
  dividendYieldPercent: number | null;
}

export interface DividendEventDto {
  ticker: string;
  type: "DIVIDENDO" | "JCP" | "OUTRO";
  rate: number;
  exDate: string | null;
  paymentDate: string | null;
  relatedTo: string | null;
}

export interface AssetAnalysis {
  ticker: string;
  assetClass: "STOCK" | "FII";
  currentPrice: number;
  changePercent: number | null;
  indicators: AssetIndicators;
  tip: { amountIfInvested100OneYearAgo: number | null };
  profitability: Record<ProfitabilityPeriod, number | null>;
  graham: GrahamResult | null;
  bazin: BazinResult | null;
  checklist: ChecklistItem[];
  dividendsByYear: DividendYearSummary[];
  dividendsPaid: DividendEventDto[];
  dividendsUpcoming: DividendEventDto[];
  dividendMonthRadar: DividendMonthRadarEntry[];
  payoutHistory: PayoutYearEntry[];
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

// ---------------------------------------------------------------------------
// Importação B3
// ---------------------------------------------------------------------------

export type ImportAssetClass = "STOCK" | "FII";

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
  type: "DIVIDENDO" | "JCP" | "RENDIMENTO" | "OUTRO";
  amount: number;
  paymentDate: string;
  sourceLabel: string;
}

export interface ImportSkippedRow {
  source: "negociacao" | "movimentacao";
  description: string;
  reason: string;
}

export interface DividendSuggestion {
  ticker: string;
  assetClass: ImportAssetClass;
  type: "DIVIDENDO" | "JCP" | "OUTRO";
  amount: number;
  paymentDate: string;
  exDate: string | null;
  relatedTo: string | null;
  quantityHeld: number;
}

export interface B3ImportPreviewResult {
  transactions: ImportedTransaction[];
  incomes: ImportedIncome[];
  skipped: ImportSkippedRow[];
  suggestedIncomes: DividendSuggestion[];
  duplicateTransactionsSkipped: number;
  duplicateIncomesSkipped: number;
}

export interface B3ImportCommitResult {
  createdAssets: number;
  importedTransactions: number;
  importedIncomes: number;
  /** Dividendos/JCP calculados automaticamente a partir do histórico da BRAPI após a importação —
   *  não fazem parte da seleção do usuário, são sempre recalculados. */
  autoCalculatedIncomes: number;
}

// ---------------------------------------------------------------------------
// Lançamentos (gerenciar/editar/apagar)
// ---------------------------------------------------------------------------

export interface LaunchTransaction {
  id: string;
  type: TransactionType;
  quantity: string;
  unitPrice: string;
  fees: string;
  transactionDate: string;
  notes: string | null;
  asset: { ticker: string; class: AssetClass };
}

export interface LaunchIncome {
  id: string;
  type: string;
  amount: string;
  paymentDate: string;
  notes: string | null;
  asset: { ticker: string; class: AssetClass } | null;
}

export interface LaunchesResponse {
  transactions: LaunchTransaction[];
  incomes: LaunchIncome[];
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
  /** O dinheiro que foi aportado e ainda está aqui — é o "Investido" da tela. Só difere do
   *  principalAmount depois de um resgate parcial, quando o principal vira base de rendimento. */
  contributedAmount: number;
  /** Ganho medido contra o aportado. Use este, não o netYield, em qualquer coisa que a pessoa vá
   *  comparar com o extrato do banco. */
  netGain: number;
  netGainPercent: number;
}

export interface InvestmentFixedIncome {
  id: string;
  institution: string;
  type: FixedIncomeType;
  /** Base de rendimento. Depois de um resgate parcial ela deixa de ser "o que eu pus" — pra isso
   *  use contributedAmount. */
  principalAmount: string;
  /** Já vem resolvido pelo backend (number, não a Decimal em string): nunca é null. */
  contributedAmount: number;
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
  /** Só em aplicações pós-fixadas ao CDI; null nas demais. */
  cdiSource: CdiSource | null;
  incomeHistory?: InvestmentIncomeRow[];
}

/** De onde veio o CDI usado no cálculo — a diferença entre "bate com o banco" e "é estimativa". */
export interface CdiSource {
  /** true = série diária oficial do Bacen, dia útil por dia útil. false = extrapolado da taxa de hoje. */
  official: boolean;
  /** Quantos dias úteis da série entraram na conta. */
  businessDays: number;
  /** Último dia útil coberto pela série (ISO), ou null se ela não foi usada. */
  lastDate: string | null;
  /** Dias úteis completados com a última taxa publicada, porque o Bacen divulga a taxa de um dia
   *  só depois dele fechar e o extrato já conta esse dia. Normalmente 0 ou 1. */
  projectedDays: number;
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
  /** Total ganho por categoria (realizado + não realizado) — diferente de distribuicaoPorCategoria,
   *  que é valor atual, não lucro. Uma renda fixa já resgatada continua aparecendo aqui mesmo sem
   *  nenhuma aplicação ativa no momento. */
  ganhosPorCategoria: { category: string; total: number }[];
  distribuicaoPorAtivo: { label: string; class: string; value: number }[];
  topGanhos: { label: string; class: string; profit: number; profitPercent: number }[];
  topPerdas: { label: string; class: string; profit: number; profitPercent: number }[];
  proximosVencimentos: { id: string; institution: string; type: string; maturityDate: string; netValue: number }[];
  ultimosLancamentos: { id: string; entity: string; action: string; changes: unknown; createdAt: string }[];
  evolucaoPatrimonial: { series: { month: string; capitalInvestido: number }[]; currentPatrimony: number };
}
