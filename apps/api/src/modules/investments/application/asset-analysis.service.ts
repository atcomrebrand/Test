import { Injectable } from "@nestjs/common";
import { DividendAssetClass, DividendEvent } from "../domain/market-data.provider";
import {
  computeAmountIfInvested,
  computeBazinCeiling,
  computeChecklist,
  computeDividendMonthRadar,
  computeGrahamFairPrice,
  computePayoutHistory,
  computeProfitabilityPeriods,
  groupDividendsByYear,
} from "../domain/asset-analysis";
import { MarketPriceService } from "../infrastructure/market-price.service";
import { DividendsCacheService } from "../infrastructure/dividends-cache.service";

/** How many recent years feed the Bazin ceiling's "average annual dividend" input. */
const BAZIN_LOOKBACK_YEARS = 5;

function numberField(fundamentals: Record<string, number | string | null>, label: string): number | null {
  const value = fundamentals[label];
  return typeof value === "number" ? value : null;
}

/**
 * Composes everything the expanded asset detail page needs (Visão Geral, Indicadores, Checklist,
 * Proventos) from data already available through MarketPriceService/DividendsCacheService — the
 * only new external calls are MarketPriceService.getAdvancedFundamentals()'s heavier BRAPI modules
 * lookup, which is itself best-effort and independently cached. Shared by both AssetsService
 * (owned) and MarketExplorerService (explore) so the analysis is identical either way.
 */
@Injectable()
export class AssetAnalysisService {
  constructor(
    private readonly marketPrice: MarketPriceService,
    private readonly dividendsCache: DividendsCacheService,
  ) {}

  /** Stocks/FIIs only — every metric here (P/L, ROE, Graham, Bazin...) is an equity-valuation
   *  concept that doesn't apply to crypto or fund quotas, so callers shouldn't offer this tab for
   *  those classes in the first place. */
  async analyze(assetClass: "STOCK" | "FII", ticker: string) {
    const normalizedTicker = ticker.toUpperCase();
    const dividendAssetClass: DividendAssetClass = assetClass;

    const detail = await this.marketPrice.getDetail(assetClass, normalizedTicker);
    if (!detail) return null;

    const [advanced, dividends, monthlyHistory] = await Promise.all([
      this.marketPrice.getAdvancedFundamentals(assetClass, normalizedTicker),
      this.dividendsCache.get(normalizedTicker, dividendAssetClass).catch(() => [] as DividendEvent[]),
      this.marketPrice.getHistory(assetClass, normalizedTicker, { range: "MAX" }),
    ]);

    const currentPrice = detail.price;
    const eps = numberField(detail.fundamentals, "LPA");
    const peRatio = numberField(detail.fundamentals, "P/L");
    const dividendYield = numberField(detail.fundamentals, "Dividend Yield");
    const dailyVolume = numberField(detail.fundamentals, "Volume");

    const dividendsByYear = groupDividendsByYear(dividends, monthlyHistory);
    const recentYears = dividendsByYear.slice(-BAZIN_LOOKBACK_YEARS);
    const avgAnnualDividend = recentYears.length > 0 ? recentYears.reduce((sum, y) => sum + y.totalPerShare, 0) / recentYears.length : null;

    const profitability = computeProfitabilityPeriods(detail.history, monthlyHistory, currentPrice, new Date());

    const now = new Date();
    const paidDividends = dividends
      .filter((d) => d.paymentDate && new Date(d.paymentDate) <= now)
      .sort((a, b) => new Date(b.paymentDate!).getTime() - new Date(a.paymentDate!).getTime())
      .slice(0, 24);
    const upcomingDividends = dividends
      .filter((d) => d.paymentDate && new Date(d.paymentDate) > now)
      .sort((a, b) => new Date(a.paymentDate!).getTime() - new Date(b.paymentDate!).getTime());

    return {
      ticker: normalizedTicker,
      assetClass,
      currentPrice,
      changePercent: detail.changePercent,
      indicators: {
        peRatio,
        priceToSales: advanced?.indicators.priceToSales ?? null,
        priceToBook: advanced?.indicators.priceToBook ?? null,
        dividendYield,
        payoutRatio: advanced?.indicators.payoutRatio ?? null,
        netMargin: advanced?.indicators.profitMargins ?? null,
        grossMargin: advanced?.indicators.grossMargins ?? null,
        returnOnEquity: advanced?.indicators.returnOnEquity ?? null,
        returnOnAssets: advanced?.indicators.returnOnAssets ?? null,
        netDebtToEquity: advanced?.indicators.debtToEquity ?? null,
        currentRatio: advanced?.indicators.currentRatio ?? null,
      },
      tip: { amountIfInvested100OneYearAgo: computeAmountIfInvested(100, profitability["1A"]) },
      profitability,
      graham: computeGrahamFairPrice(currentPrice, eps, advanced?.indicators.bookValuePerShare ?? null),
      bazin: computeBazinCeiling(currentPrice, avgAnnualDividend),
      checklist: computeChecklist({
        annualNetIncome: advanced?.annualNetIncome ?? null,
        quarterlyNetIncome: advanced?.quarterlyNetIncome ?? null,
        dividendYearYields: dividendsByYear,
        returnOnEquityPercent: advanced?.indicators.returnOnEquity ?? null,
        totalLiabilities: advanced?.totalLiabilities ?? null,
        totalStockholderEquity: advanced?.totalStockholderEquity ?? null,
        averageDailyVolumeBRL: dailyVolume !== null ? dailyVolume * currentPrice : null,
      }),
      dividendsByYear,
      dividendsPaid: paidDividends,
      dividendsUpcoming: upcomingDividends,
      dividendMonthRadar: computeDividendMonthRadar(dividends),
      payoutHistory: advanced?.annualNetIncome ? computePayoutHistory(advanced.annualNetIncome, dividendsByYear) : [],
    };
  }
}
