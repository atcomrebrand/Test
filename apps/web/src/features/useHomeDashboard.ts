import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface HomeNetWorth {
  assets: number;
  /** Quanto dos ativos vem da carteira de investimentos… */
  investedAssets: number;
  /** …e quanto vem de bem financiado avaliado (FIPE/avaliação). Os dois somam `assets`. */
  financedAssets: number;
  debts: number;
  netWorth: number;
  debtToAssetPct: number | null;
  /** Bens financiados ativos ainda sem valor informado — o patrimônio está incompleto. */
  assetsPendingValuation: number;
}

export interface HomeUpcomingEvent {
  source: "parcelamento" | "casa" | "financiamento" | "investimentos";
  label: string;
  date: string;
  amount: number | null;
}

export interface HomeDashboard {
  netWorth: HomeNetWorth;
  monthly: {
    income: number;
    committed: number;
    freeBalance: number;
    savingsRatePct: number | null;
  };
  percentages: {
    limitUsagePct: number;
    investmentReturnPct: number;
    fixedIncomeReturnPct: number;
    variableReturnPct: number;
    savingsRatePct: number | null;
    hoursGrowthPct: number | null;
  };
  modules: {
    parcelamento: {
      committedThisMonth: number;
      committedNextMonth: number;
      totalRemaining: number;
      openInstallmentsCount: number;
      limitUsage: { totalLimit: number; totalSpent: number; usagePct: number };
      nextDue: { cardId: string; cardName: string; date: string } | null;
    };
    casa: {
      totalIncome: number;
      totalCommitted: number;
      freeBalance: number;
      billsPendingCount: number;
      billsLateCount: number;
      savingsRate: number | null;
    };
    investimentos: {
      patrimonioTotal: number;
      lucroLiquido: number;
      rentabilidadePercent: number;
      aportesDoMes: number;
    };
    horas: {
      hoursThisMonth: number;
      totalRevenue: number;
      productivityGrowthPercent: number | null;
      insights: string[];
    };
    financiamentos: {
      totalActive: number;
      committedThisMonth: number;
      totalRemaining: number;
      nextInstallment: { financingId: string; financingName: string; dueDate: string; amount: number } | null;
      equity: { assetsValue: number; debt: number; equity: number; withoutAssetValue: number };
    };
    cotacoes: { symbol: string; label: string; flag: string; rate: number | null; previousClose: number | null }[];
  };
  upcomingEvents: HomeUpcomingEvent[];
  forecast: {
    nextMonth: { householdCommitted: number | null; householdIncome: number | null };
    insights: string[];
  };
  spendingEvolution: { year: number; month: number; total: number }[];
}

export function useHomeDashboard() {
  return useQuery({
    queryKey: ["home", "dashboard"],
    queryFn: () => api.get<HomeDashboard>("/home/dashboard"),
    refetchInterval: 60_000,
  });
}
