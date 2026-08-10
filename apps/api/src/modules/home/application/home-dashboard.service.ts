import { Injectable } from "@nestjs/common";
import { DashboardService } from "../../dashboard/dashboard.service";
import { HouseholdDashboardService } from "../../household/application/household-dashboard.service";
import { InvestmentsDashboardService } from "../../investments/application/investments-dashboard.service";
import { TrackingDashboardService } from "../../tracking/application/tracking-dashboard.service";
import { FinancingsService } from "../../financings/application/financings.service";
import { QuotesService } from "../../quotes/quotes.service";
import { calculateNetWorth } from "../domain/net-worth-calculator";
import { computeFinancingPayoffDebt } from "../domain/financing-payoff-debt";
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

    const [
      parcelamentoSummary,
      spendingEvolution,
      householdMonth,
      householdHistory,
      investmentsSummary,
      trackingSummary,
      financingsSummary,
      financingsList,
      ticker,
    ] = await Promise.all([
      this.parcelamento.summary(userId),
      this.parcelamento.spendingEvolution(userId),
      this.household.month(userId, year, month),
      Promise.all(closedMonths.map((m) => this.household.month(userId, m.year, m.month))),
      this.investments.summary(userId),
      this.tracking.summary(userId),
      this.financings.summary(userId),
      this.financings.findAll(userId),
      this.quotes.ticker(),
    ]);

    // O Parcelamento já embute a dívida de financiamento em committedThisMonth/committedNextMonth/
    // totalRemaining quando Setting.includeFinancingInTotals está ligado (padrão) — o sub-objeto
    // `financing` sempre traz os números crus de financiamento nele embutidos, então dá pra
    // subtrair e isolar "só cartão" independente do estado do toggle.
    const financingWithinParcelamento = parcelamentoSummary.includeFinancingInTotals;
    const financingPortion = {
      thisMonth: financingWithinParcelamento ? parcelamentoSummary.financing.committedThisMonth : 0,
      nextMonth: financingWithinParcelamento ? parcelamentoSummary.financing.committedNextMonth : 0,
      remaining: financingWithinParcelamento ? parcelamentoSummary.financing.totalRemaining : 0,
    };
    const parcelamentoCardsOnly = {
      committedThisMonth: parcelamentoSummary.committedThisMonth - financingPortion.thisMonth,
      committedNextMonth: parcelamentoSummary.committedNextMonth - financingPortion.nextMonth,
      totalRemaining: parcelamentoSummary.totalRemaining - financingPortion.remaining,
    };

    // Patrimônio líquido aqui é especificamente "investimentos menos dívida de financiamento" —
    // NÃO entra dívida de cartão (Parcelas), por instrução explícita: cartão é gasto já
    // comprometido/conhecido, não uma dívida de longo prazo pra abater do patrimônio do mesmo jeito
    // que financiamento. Por isso o card no front chama "Patrimônio + Financiamentos", não
    // "Patrimônio líquido" genérico.
    //
    // A dívida usada é a quitação à vista (Financing.payoffAmount), não a soma nominal das
    // parcelas restantes — essa soma embute juros futuros que ainda nem venceram, superestimando
    // a dívida real. Só cai pra soma de parcelas quando o financiamento nunca foi cotado.
    const financingPayoffDebt = computeFinancingPayoffDebt(
      financingsList.map((f) => ({
        active: f.active,
        payoffAmount: f.payoffAmount !== null ? Number(f.payoffAmount) : null,
        installments: f.installments.map((i) => ({ status: i.status, amount: Number(i.amount) })),
      })),
    );
    //
    // O bem financiado entra do lado dos ativos: a dívida sozinha só contava a metade negativa da
    // conta (um carro de R$ 60.000 com R$ 20.000 de quitação aparecia como −R$ 20.000). Bem sem
    // avaliação informada não entra como zero — fica de fora e `assetsPendingValuation` avisa a
    // tela de que o número está incompleto, em vez de mostrar um líquido pessimista sem explicação.
    const financedAssetsValue = financingsList
      .filter((f) => f.active && f.assetValue !== null)
      .reduce((sum, f) => sum + Number(f.assetValue), 0);
    const assetsPendingValuation = financingsList.filter((f) => f.active && f.assetValue === null).length;

    const netWorth = {
      ...calculateNetWorth({
        investedAssets: investmentsSummary.cards.patrimonioTotal,
        financedAssets: financedAssetsValue,
        totalDebt: financingPayoffDebt,
      }),
      assetsPendingValuation,
    };

    // Visão mensal combinada usa só a Casa — Parcelas e Financiamento têm cada um seu próprio card
    // (abaixo) com os números só deles, sem entrar nessa soma. Misturá-los aqui duplicaria: a Casa
    // já reflete "quanto preciso ter em mãos esse mês" incluindo fatura de cartão (via fatura
    // presumida de cartões vinculados) e eventuais parcelas de financiamento lançadas manualmente
    // como conta — somar Parcelamento/Financiamento por cima contaria essas parcelas duas vezes.
    // Contas da Casa é "o real incontestável" (mesma instrução que já vale pra renda: Horas não
    // entra aqui, é só controle pessoal).
    const combinedIncome = householdMonth.totalIncome;
    const combinedCommitted = householdMonth.totalCommitted;
    const freeBalance = householdMonth.freeBalance;

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
        // Rentabilidade sempre sobre o total investido (não sobre o valor atual) — mesmo critério
        // nos três, só muda a base: renda fixa, variável (ações/FIIs/cripto) e a carteira inteira.
        investmentReturnPct: investmentsSummary.cards.rentabilidadePercent,
        fixedIncomeReturnPct: investmentsSummary.cards.rendaFixaRentabilidadePercent,
        variableReturnPct: investmentsSummary.cards.variavelRentabilidadePercent,
        savingsRatePct: householdMonth.savingsRate,
        hoursGrowthPct: trackingSummary.productivityGrowthPercent,
      },
      modules: {
        parcelamento: {
          // Só cartão — financiamento já foi retirado daqui em cima (financingPortion), pra este
          // card mostrar exclusivamente os números do Parcelamento, sem se misturar com o card de
          // Financiamentos abaixo.
          committedThisMonth: parcelamentoCardsOnly.committedThisMonth,
          committedNextMonth: parcelamentoCardsOnly.committedNextMonth,
          totalRemaining: parcelamentoCardsOnly.totalRemaining,
          openInstallmentsCount: parcelamentoSummary.openInstallmentsCount,
          limitUsage: parcelamentoSummary.limitUsage,
          nextDue: parcelamentoSummary.nextDue,
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
          equity: financingsSummary.equity,
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
