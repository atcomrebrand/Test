import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import {
  ArticlePreview,
  AssetAnalysis,
  AssetQuoteDetailResponse,
  B3ImportCommitResult,
  B3ImportPreviewResult,
  CashAccount,
  CatalogEntry,
  ChartRangeParams,
  DashboardSummary,
  HistoricalPricePoint,
  DividendCalendarEntry,
  ImportedIncome,
  ImportedTransaction,
  InvestmentAsset,
  InvestmentFixedIncome,
  LaunchesResponse,
  MarketQuoteDetailResponse,
  NewsArticle,
} from "./types";

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["investments"] });
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function useInvestmentsDashboard() {
  return useQuery({
    queryKey: ["investments", "dashboard"],
    queryFn: () => api.get<DashboardSummary>("/investments/dashboard/summary"),
  });
}

/** Forces fresh prices (bypassing the backend's cache TTL) before recomputing every card on the
 *  dashboard — patrimônio, distribuição, maiores ganhos/perdas etc all derive from asset prices. */
export function useRefreshInvestmentsDashboard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.get<DashboardSummary>("/investments/dashboard/summary", { params: { refresh: "true" } }),
    onSuccess: (data) => {
      qc.setQueryData(["investments", "dashboard"], data);
      toast.success("Dashboard atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface InvestmentHistoryPage {
  items: { id: string; entity: string; action: string; changes: unknown; createdAt: string }[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export function useInvestmentHistory(page: number) {
  return useQuery({
    queryKey: ["investments", "history", page],
    queryFn: () => api.get<InvestmentHistoryPage>("/investments/dashboard/history", { params: { page, pageSize: 20 } }),
  });
}

// ---------------------------------------------------------------------------
// Assets (Ações / FIIs / Criptomoedas)
// ---------------------------------------------------------------------------

/** Powers the "browse instead of type blind" picker in AssetFormModal. */
export function useAssetCatalog(assetClass: string, query: string) {
  return useQuery({
    queryKey: ["investments", "catalog", assetClass, query],
    queryFn: () => api.get<CatalogEntry[]>("/investments/catalog", { params: { class: assetClass, query } }),
    enabled: query.trim().length >= 2,
    staleTime: 60_000,
  });
}

/** Powers "Explorar" — price/chart/fundamentals for any ticker, owned or not. */
export function useMarketQuoteDetail(assetClass: string, ticker: string | null) {
  return useQuery({
    queryKey: ["investments", "market", assetClass, ticker],
    queryFn: () => api.get<MarketQuoteDetailResponse>("/investments/catalog/quote-detail", { params: { class: assetClass, ticker } }),
    enabled: !!ticker,
  });
}

/** Price history for the chart's time-range selector — a separate query from useMarketQuoteDetail
 *  so switching ranges only refetches the chart, not the price/fundamentals shown alongside it. */
export function useMarketHistory(assetClass: string, ticker: string | null, params: ChartRangeParams) {
  return useQuery({
    queryKey: ["investments", "market", "history", assetClass, ticker, params],
    queryFn: () => api.get<HistoricalPricePoint[]>("/investments/catalog/history", { params: { class: assetClass, ticker, ...params } }),
    enabled: !!ticker && (params.range !== "CUSTOM" || (!!params.from && !!params.to)),
  });
}

/** Indicadores/Checklist/Proventos analysis tab — same shape for both "Explorar" (any ticker) and
 *  "Minha carteira" (below), backed by the same server endpoint either way. Stocks/FIIs only —
 *  callers shouldn't even render the tab for CRYPTO. */
export function useMarketAnalysis(assetClass: string, ticker: string | null) {
  return useQuery({
    queryKey: ["investments", "market", "analysis", assetClass, ticker],
    queryFn: () => api.get<AssetAnalysis | null>("/investments/catalog/analysis", { params: { class: assetClass, ticker } }),
    enabled: !!ticker && (assetClass === "STOCK" || assetClass === "FII"),
    staleTime: 5 * 60_000,
  });
}

export function useRefreshMarketQuoteDetail(assetClass: string, ticker: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.get<MarketQuoteDetailResponse>("/investments/catalog/quote-detail", { params: { class: assetClass, ticker, refresh: "true" } }),
    onSuccess: (data) => {
      qc.setQueryData(["investments", "market", assetClass, ticker], data);
      toast.success("Preço atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAssets(assetClass?: string, enabled = true) {
  return useQuery({
    queryKey: ["investments", "assets", assetClass ?? "all"],
    queryFn: () => api.get<InvestmentAsset[]>("/investments/assets", { params: assetClass ? { class: assetClass } : undefined }),
    enabled,
  });
}

/** Forces a fresh price fetch for every asset in this tab, bypassing the backend's cache TTL. */
export function useRefreshAssets(assetClass?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.get<InvestmentAsset[]>("/investments/assets", { params: { ...(assetClass ? { class: assetClass } : {}), refresh: "true" } }),
    onSuccess: (data) => {
      qc.setQueryData(["investments", "assets", assetClass ?? "all"], data);
      toast.success("Preços atualizados!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAsset(id: string | null) {
  return useQuery({
    queryKey: ["investments", "assets", "detail", id],
    queryFn: () => api.get<InvestmentAsset>(`/investments/assets/${id}`),
    enabled: !!id,
  });
}

export function useAssetQuoteDetail(id: string | null) {
  return useQuery({
    queryKey: ["investments", "assets", "quote-detail", id],
    queryFn: () => api.get<AssetQuoteDetailResponse>(`/investments/assets/${id}/quote-detail`),
    enabled: !!id,
  });
}

/** Price history for the chart's time-range selector — a separate query from useAssetQuoteDetail
 *  so switching ranges only refetches the chart, not the price/fundamentals shown alongside it. */
export function useAssetHistory(id: string | null, params: ChartRangeParams) {
  return useQuery({
    queryKey: ["investments", "assets", "history", id, params],
    queryFn: () => api.get<HistoricalPricePoint[]>(`/investments/assets/${id}/history`, { params }),
    enabled: !!id && (params.range !== "CUSTOM" || (!!params.from && !!params.to)),
  });
}

/** Same analysis as useMarketAnalysis, for an owned asset by id instead of a ticker. */
export function useAssetAnalysis(id: string | null, assetClass?: string) {
  return useQuery({
    queryKey: ["investments", "assets", "analysis", id],
    queryFn: () => api.get<AssetAnalysis | null>(`/investments/assets/${id}/analysis`),
    enabled: !!id && (assetClass === "STOCK" || assetClass === "FII"),
    staleTime: 5 * 60_000,
  });
}

/** Forces a fresh fetch past the cache (bypasses the backend's 5-30min TTL) and writes the
 *  result straight into the regular query's cache so the page updates immediately. */
export function useRefreshAssetQuote(id: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.get<AssetQuoteDetailResponse>(`/investments/assets/${id}/quote-detail`, { params: { refresh: "true" } }),
    onSuccess: (data) => {
      qc.setQueryData(["investments", "assets", "quote-detail", id], data);
      toast.success("Preço atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<InvestmentAsset>("/investments/assets", data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Ativo cadastrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch<InvestmentAsset>(`/investments/assets/${id}`, data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Ativo atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Same PATCH as useUpdateAsset but silent — starring/unstarring shouldn't pop a toast every click. */
export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, favorite }: { id: string; favorite: boolean }) => api.patch<InvestmentAsset>(`/investments/assets/${id}`, { favorite }),
    onSuccess: () => invalidateAll(qc),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/investments/assets/${id}`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Ativo removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, data }: { assetId: string; data: Record<string, unknown> }) =>
      api.post(`/investments/assets/${assetId}/transactions`, data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Lançamento registrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddAssetIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, data }: { assetId: string; data: Record<string, unknown> }) =>
      api.post(`/investments/assets/${assetId}/income`, data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Provento registrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Renda Fixa
// ---------------------------------------------------------------------------

export function useFixedIncomes() {
  return useQuery({
    queryKey: ["investments", "fixed-incomes"],
    queryFn: () => api.get<InvestmentFixedIncome[]>("/investments/fixed-incomes"),
  });
}

export function useFixedIncome(id: string | null) {
  return useQuery({
    queryKey: ["investments", "fixed-incomes", "detail", id],
    queryFn: () => api.get<InvestmentFixedIncome>(`/investments/fixed-incomes/${id}`),
    enabled: !!id,
  });
}

export function useCreateFixedIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<InvestmentFixedIncome>("/investments/fixed-incomes", data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Aplicação cadastrada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteFixedIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/investments/fixed-incomes/${id}`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Aplicação removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRedeemFixedIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<InvestmentFixedIncome>(`/investments/fixed-incomes/${id}/redeem`, {}),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Resgate registrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAddFixedIncomeInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.post(`/investments/fixed-incomes/${id}/interest`, data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Juros registrados!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Notícias
// ---------------------------------------------------------------------------

export function useMarketNews() {
  return useQuery({
    queryKey: ["investments", "news", "market"],
    queryFn: () => api.get<NewsArticle[]>("/investments/news/market"),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePortfolioNews() {
  return useQuery({
    queryKey: ["investments", "news", "portfolio"],
    queryFn: () => api.get<NewsArticle[]>("/investments/news/portfolio"),
    staleTime: 5 * 60 * 1000,
  });
}

/** Rich in-app preview for the article popup — real Open Graph data from the article's own page. */
export function useArticlePreview(link: string | null) {
  return useQuery({
    queryKey: ["investments", "news", "preview", link],
    queryFn: () => api.get<ArticlePreview>("/investments/news/preview", { params: { link } }),
    enabled: !!link,
    staleTime: 30 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Calendário de proventos
// ---------------------------------------------------------------------------

export function useMarketDividends() {
  return useQuery({
    queryKey: ["investments", "dividends", "market"],
    queryFn: () => api.get<DividendCalendarEntry[]>("/investments/dividends/market"),
    staleTime: 10 * 60 * 1000,
  });
}

export function usePortfolioDividends() {
  return useQuery({
    queryKey: ["investments", "dividends", "portfolio"],
    queryFn: () => api.get<DividendCalendarEntry[]>("/investments/dividends/portfolio"),
    staleTime: 10 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Importação B3
// ---------------------------------------------------------------------------

export function usePreviewB3Import() {
  return useMutation({
    mutationFn: (payload: { negociacao: Record<string, unknown>[]; movimentacao: Record<string, unknown>[] }) =>
      api.post<B3ImportPreviewResult>("/investments/import/b3/preview", payload),
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Alternate, simpler import source: a single CSV with one row per transaction — no dividend
 *  rows at all, since those are derived from BRAPI's history regardless of import source. */
export function usePreviewCsvImport() {
  return useMutation({
    mutationFn: (rows: Record<string, unknown>[]) => api.post<B3ImportPreviewResult>("/investments/import/b3/csv/preview", { rows }),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCommitB3Import() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { transactions: ImportedTransaction[]; incomes: ImportedIncome[] }) =>
      api.post<B3ImportCommitResult>("/investments/import/b3/commit", payload),
    onSuccess: (result) => {
      invalidateAll(qc);
      const autoNote = result.autoCalculatedIncomes > 0 ? ` + ${result.autoCalculatedIncomes} calculados automaticamente` : "";
      toast.success(`Importado! ${result.importedTransactions} negociações e ${result.importedIncomes} proventos${autoNote}.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Lançamentos (gerenciar/editar/apagar)
// ---------------------------------------------------------------------------

export function useLaunches() {
  return useQuery({
    queryKey: ["investments", "lancamentos"],
    queryFn: () => api.get<LaunchesResponse>("/investments/lancamentos"),
  });
}

export function useUpdateLaunchTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch(`/investments/lancamentos/transactions/${id}`, data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Lançamento atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteLaunchTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/investments/lancamentos/transactions/${id}`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Lançamento removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateLaunchIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => api.patch(`/investments/lancamentos/incomes/${id}`, data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Provento atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteLaunchIncome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/investments/lancamentos/incomes/${id}`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Provento removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Zerar carteira (facilita testes)
// ---------------------------------------------------------------------------

export function useResetInvestments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/investments/reset", {}),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Carteira zerada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---------------------------------------------------------------------------
// Caixa / Contas bancárias
// ---------------------------------------------------------------------------

export function useCashAccounts() {
  return useQuery({
    queryKey: ["investments", "cash-accounts"],
    queryFn: () => api.get<CashAccount[]>("/investments/cash-accounts"),
  });
}

export function useCreateCashAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post("/investments/cash-accounts", data),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Conta cadastrada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCashAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/investments/cash-accounts/${id}`),
    onSuccess: () => {
      invalidateAll(qc);
      toast.success("Conta removida.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
