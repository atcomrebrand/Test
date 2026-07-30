import { Injectable } from "@nestjs/common";
import { DashboardService } from "../../dashboard/dashboard.service";
import { HouseholdDashboardService } from "../../household/application/household-dashboard.service";
import { InvestmentsDashboardService } from "../../investments/application/investments-dashboard.service";
import { TrackingDashboardService } from "../../tracking/application/tracking-dashboard.service";
import { FinancingsService } from "../../financings/application/financings.service";
import { QuotesService } from "../../quotes/quotes.service";
import { calculateNetWorth } from "../domain/net-worth-calculator";
import { computeTrailingForecast, generateForecastInsight } from "../domain/spending-forecast";
import { mergeUpcomingEvents, UpcomingEvent } from "../domain/upcoming-events-merger";

const FORECAST_HISTORY_MONTHS = 3;

function shiftMonth(year: number, month: number, offset: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + offset, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

@Injectable()
export class HomeDashboardService {
  constructor(
    private readonly parcelamento: DashboardService,
    private readonly household: HouseholdDashboardService,
    private readonly investments: InvestmentsDashboardService,
    private readonly tracking: TrackingDashboardService,
    private readonly financings: FinancingsService,
    private readonly quotes: QuotesService,
  ) {}

  async summary(userId: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Últimos meses fechados da Casa (não o corrente, que ainda está em andamento) — histórico
    // pra alimentar a previsão por média móvel abaixo. Diferente do Parcelamento (parcelas já
    // pré-geradas, então o mês que vem já é conhecido) e do Financiamento (parcelas fixas), o
    // total da Casa varia mês a mês (contas de consumo, renda variável), então é o único lugar
    // onde uma previsão baseada em histórico realmente agrega algo novo.
    const closedMonths = Array.from({ length: FORECAST_HISTORY_MONTHS }, (_, i) => shiftMonth(year, month, -(FORECAST_HISTORY_MONTHS - i)));

    const [parcelamentoSummary, spendingEvolution, householdMonth, householdHistory, investmentsSummary, trackingSummary, financingsSummary, ticker] =
      await Promise.all([
        this.parcelamento.summary(userId),
        this.parcelamento.spendingEvolution(userId),
        this.household.month(userId, year, month),
        Promise.all(closedMonths.map((m) => this.household.month(userId, m.year, m.month))),
        this.investments.summary(userId),
        this.tracking.summary(userId),
        this.financings.summary(userId),
        this.quotes.ticker(),
      ]);

    // O Parcelamento já embute a dívida de financiamento em committedThisMonth/totalRemaining
    // quando Setting.includeFinancingInTotals está ligado (padrão). Só somamos os números "crus"
    // do FinancingsService por fora quando o toggle estiver desligado — senão a dívida de
    // financiamento conta duas vezes no total combinado.
    const financingAlreadyIncluded = parcelamentoSummary.includeFinancingInTotals;
    const standaloneFinancingDebt = financingAlreadyIncluded ? 0 : financingsSummary.totalRemaining;
    const standaloneFinancingThisMonth = financingAlreadyIncluded ? 0 : financingsSummary.committedThisMonth;

    const netWorth = calculateNetWorth({
      investedAssets: investmentsSummary.cards.patrimonioTotal,
      totalDebt: parcelamentoSummary.totalRemaining + standaloneFinancingDebt,
    });

    // Renda combinada usa só a Casa (Contas da Casa é "o real incontestável", por instrução
    // explícita) — a receita rastreada em Horas é controle pessoal e não entra aqui, pra não
    // contar o mesmo salário duas vezes.
    const combinedIncome = householdMonth.totalIncome;
    // Cartões próprios da Casa são intencionalmente separados dos cartões do Parcelamento (ver
    // CLAUDE.md) — quando um cartão da Casa está vinculado a um cartão do Parcelamento e usando
    // fatura presumida, o valor presumido já reflete parcelas do Parcelamento, então pode haver
    // alguma sobreposição pontual nesse caso específico. Não vale a pena resolver isso agora
    // (exigiria consultar vínculos de cartão que nenhum serviço hoje expõe) — mesma ressalva que
    // já existe entre "mês no Parcelamento" x "mês na Casa" por causa de competência x vencimento.
    const combinedCommitted = parcelamentoSummary.committedThisMonth + householdMonth.totalCommitted + standaloneFinancingThisMonth;
    const freeBalance = combinedIncome - combinedCommitted;

    const committedHistory = householdHistory.map((h) => h.totalCommitted);
    const incomeHistory = householdHistory.map((h) => h.totalIncome);
    const committedForecast = computeTrailingForecast({ history: committedHistory });
    const incomeForecast = computeTrailingForecast({ history: incomeHistory });

    const forecastInsights = [
      generateForecastInsight({ label: "as contas da Casa", forecast: committedForecast.forecast, trendPct: committedForecast.trendPct }),
      generateForecastInsight({ label: "sua renda da Casa", forecast: incomeForecast.forecast, trendPct: incomeForecast.trendPct }),
    ].filter((insight): insight is string => insight !== null);

    const events: UpcomingEvent[] = [];
    if (parcelamentoSummary.nextDue) {
      events.push({
        source: "parcelamento",
        label: `Fatura ${parcelamentoSummary.nextDue.cardName}`,
        date: parcelamentoSummary.nextDue.date,
        amount: null,
      });
    }
    for (const bill of householdMonth.upcomingDue) {
      events.push({ source: "casa", label: bill.name, date: bill.dueDate, amount: bill.amount });
    }
    if (financingsSummary.nextInstallment) {
      events.push({
        source: "financiamento",
        label: financingsSummary.nextInstallment.financingName,
        date: financingsSummary.nextInstallment.dueDate,
        amount: financingsSummary.nextInstallment.amount,
      });
    }
    for (const maturity of investmentsSummary.proximosVencimentos) {
      events.push({ source: "investimentos", label: `Vencimento ${maturity.institution}`, date: maturity.maturityDate, amount: maturity.netValue });
    }

    return {
      netWorth,
      monthly: {
        income: combinedIncome,
        committed: combinedCommitted,
        freeBalance,
        savingsRatePct: householdMonth.savingsRate,
      },
      percentages: {
        limitUsagePct: parcelamentoSummary.limitUsage.usagePct,
        investmentReturnPct: investmentsSummary.cards.rentabilidadePercent,
        savingsRatePct: householdMonth.savingsRate,
        hoursGrowthPct: trackingSummary.productivityGrowthPercent,
      },
      modules: {
        parcelamento: {
          committedThisMonth: parcelamentoSummary.committedThisMonth,
          committedNextMonth: parcelamentoSummary.committedNextMonth,
          totalRemaining: parcelamentoSummary.totalRemaining,
          openInstallmentsCount: parcelamentoSummary.openInstallmentsCount,
          limitUsage: parcelamentoSummary.limitUsage,
          nextDue: parcelamentoSummary.nextDue,
          // Diz ao front se o financiamento já está embutido nos números acima — necessário pra
          // montar qualquer breakdown visual (ex: "pra onde vai o dinheiro") sem contar a dívida
          // de financiamento duas vezes, mesma regra aplicada em combinedCommitted acima.
          includeFinancingInTotals: parcelamentoSummary.includeFinancingInTotals,
        },
        casa: {
          totalIncome: householdMonth.totalIncome,
          totalCommitted: householdMonth.totalCommitted,
          freeBalance: householdMonth.freeBalance,
          billsPendingCount: householdMonth.billsPendingCount,
          billsLateCount: householdMonth.billsLateCount,
          savingsRate: householdMonth.savingsRate,
        },
        investimentos: {
          patrimonioTotal: investmentsSummary.cards.patrimonioTotal,
          lucroLiquido: investmentsSummary.cards.lucroLiquido,
          rentabilidadePercent: investmentsSummary.cards.rentabilidadePercent,
          aportesDoMes: investmentsSummary.cards.aportesDoMes,
        },
        horas: {
          hoursThisMonth: trackingSummary.hoursThisMonth,
          totalRevenue: trackingSummary.totalRevenue,
          productivityGrowthPercent: trackingSummary.productivityGrowthPercent,
          insights: trackingSummary.insights,
        },
        financiamentos: {
          totalActive: financingsSummary.totalActive,
          committedThisMonth: financingsSummary.committedThisMonth,
          totalRemaining: financingsSummary.totalRemaining,
          nextInstallment: financingsSummary.nextInstallment,
        },
        cotacoes: ticker,
      },
      upcomingEvents: mergeUpcomingEvents(events, now),
      spendingEvolution,
      forecast: {
        nextMonth: {
          householdCommitted: committedForecast.forecast,
          householdIncome: incomeForecast.forecast,
        },
        insights: forecastInsights,
      },
    };
  }
}
