import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { AssetsService } from "./assets.service";
import { FixedIncomesService } from "./fixed-incomes.service";
import { CashAccountRepository } from "../domain/cash-account.repository";

const EVOLUTION_MONTHS = 12;
const RECENT_LAUNCHES_LIMIT = 10;
const TOP_LIST_LIMIT = 5;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

@Injectable()
export class InvestmentsDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly fixedIncomes: FixedIncomesService,
    private readonly cashAccounts: CashAccountRepository,
  ) {}

  async summary(userId: string, forceRefresh = false) {
    const [enrichedAssets, enrichedFixedIncomes, cashBalance] = await Promise.all([
      this.assets.findAll(userId, undefined, forceRefresh),
      this.fixedIncomes.findAll(userId),
      this.cashAccounts.sumBalancesByUser(userId),
    ]);

    const activeFixedIncomes = enrichedFixedIncomes.filter((f) => !f.redeemedAt);
    const redeemedFixedIncomes = enrichedFixedIncomes.filter((f) => f.redeemedAt);

    const assetsInvested = enrichedAssets.reduce((sum, a) => sum + a.position.investedAmount, 0);
    const assetsCurrentValue = enrichedAssets.reduce((sum, a) => sum + (a.currentValue ?? a.position.investedAmount), 0);
    const assetsRealizedProfit = enrichedAssets.reduce((sum, a) => sum + a.position.realizedProfit, 0);
    const assetsUnrealizedProfit = enrichedAssets.reduce((sum, a) => sum + (a.profit ?? 0), 0);

    const fixedIncomeInvested = activeFixedIncomes.reduce((sum, f) => sum + Number(f.principalAmount), 0);
    const fixedIncomeNetValue = activeFixedIncomes.reduce((sum, f) => sum + f.calculation.netValue, 0);
    // netYield is frozen at redemption date (see FixedIncomesService.redeem/enrich), so a redeemed
    // CDB's rentabilidade doesn't change or vanish after redemption — but until now it also wasn't
    // ADDED anywhere once redeemed, since only activeFixedIncomes fed into lucroLiquido. Including
    // redeemedFixedIncomes here makes a matured/redeemed-and-reinvested CDB's profit keep counting
    // toward total earnings forever, the same way a fully-sold stock's realizedProfit already does.
    const fixedIncomeUnrealizedYield = activeFixedIncomes.reduce((sum, f) => sum + f.calculation.netYield, 0);
    const fixedIncomeRealizedYield = redeemedFixedIncomes.reduce((sum, f) => sum + f.calculation.netYield, 0);
    const fixedIncomeNetYield = fixedIncomeUnrealizedYield + fixedIncomeRealizedYield;

    const valorInvestido = assetsInvested + fixedIncomeInvested + cashBalance;
    const valorAtual = assetsCurrentValue + fixedIncomeNetValue + cashBalance;
    const lucroLiquido = assetsUnrealizedProfit + assetsRealizedProfit + fixedIncomeNetYield;
    const rentabilidadePercent = valorInvestido > 0 ? (lucroLiquido / valorInvestido) * 100 : 0;

    const [dividendosRecebidos, jurosRecebidos, aportesDoMes] = await Promise.all([
      this.sumAssetIncome(userId),
      this.sumIncomeByType(userId, ["JUROS"]),
      this.contributionsThisMonth(userId),
    ]);

    return {
      cards: {
        patrimonioTotal: valorAtual,
        valorInvestido,
        valorAtual,
        lucroLiquido,
        rentabilidadePercent,
        dividendosRecebidos,
        jurosRecebidos,
        aportesDoMes,
      },
      distribuicaoPorCategoria: this.distribuicaoPorCategoria(enrichedAssets, fixedIncomeNetValue, cashBalance),
      distribuicaoPorAtivo: this.distribuicaoPorAtivo(enrichedAssets, activeFixedIncomes),
      // "Quanto ganhei no total" por categoria (Renda Fixa, Ações, FIIs, Cripto) — realizado
      // (posições já vendidas/CDBs já resgatados) + não realizado (o que ainda está na carteira)
      // + dividendos/proventos recebidos, pra dar o contexto geral de rentabilidade por tipo de
      // investimento, não só o valor atual.
      ganhosPorCategoria: this.ganhosPorCategoria(enrichedAssets, activeFixedIncomes, redeemedFixedIncomes),
      topGanhos: this.topMovers(enrichedAssets, activeFixedIncomes, "desc"),
      topPerdas: this.topMovers(enrichedAssets, activeFixedIncomes, "asc"),
      proximosVencimentos: this.proximosVencimentos(activeFixedIncomes),
      ultimosLancamentos: await this.ultimosLancamentos(userId),
      evolucaoPatrimonial: await this.evolucaoPatrimonial(userId, valorAtual),
    };
  }

  private distribuicaoPorCategoria(assets: Awaited<ReturnType<AssetsService["findAll"]>>, fixedIncomeNetValue: number, cashBalance: number) {
    const byClass = new Map<string, number>();
    for (const asset of assets) {
      const value = asset.currentValue ?? asset.position.investedAmount;
      byClass.set(asset.class, (byClass.get(asset.class) ?? 0) + value);
    }
    if (fixedIncomeNetValue > 0) byClass.set("RENDA_FIXA", (byClass.get("RENDA_FIXA") ?? 0) + fixedIncomeNetValue);
    if (cashBalance > 0) byClass.set("CAIXA", (byClass.get("CAIXA") ?? 0) + cashBalance);
    return Array.from(byClass.entries()).map(([category, total]) => ({ category, total }));
  }

  private distribuicaoPorAtivo(
    assets: Awaited<ReturnType<AssetsService["findAll"]>>,
    fixedIncomes: Awaited<ReturnType<FixedIncomesService["findAll"]>>,
  ) {
    const items = [
      ...assets.map((a) => ({ label: a.ticker, class: a.class, value: a.currentValue ?? a.position.investedAmount })),
      ...fixedIncomes.map((f) => ({ label: f.institution, class: f.type, value: f.calculation.netValue })),
    ];
    return items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  }

  /** Total gained per category — realized (sold positions, redeemed CDBs) + unrealized (still
   *  held) + dividendos/proventos recebidos — separate from distribuicaoPorCategoria, which is
   *  current VALUE, not profit, and from cards.lucroLiquido, which is price-appreciation-only
   *  (dividendosRecebidos/jurosRecebidos are its own stat tiles). Proventos are just as much a
   *  real gain from holding an asset as price appreciation, so this "total ganho" view folds them
   *  in — otherwise dividend-heavy stocks/FIIs would look like they earned far less than they
   *  actually did. A redeemed fixed income keeps contributing here even with zero active
   *  applications: its netYield is frozen at the redemption date, so reinvesting the proceeds
   *  elsewhere doesn't erase what it already earned. */
  private ganhosPorCategoria(
    assets: Awaited<ReturnType<AssetsService["findAll"]>>,
    activeFixedIncomes: Awaited<ReturnType<FixedIncomesService["findAll"]>>,
    redeemedFixedIncomes: Awaited<ReturnType<FixedIncomesService["findAll"]>>,
  ) {
    const byClass = new Map<string, number>();
    for (const asset of assets) {
      const gain = (asset.profit ?? 0) + asset.position.realizedProfit + asset.dividendsReceived;
      byClass.set(asset.class, (byClass.get(asset.class) ?? 0) + gain);
    }
    if (activeFixedIncomes.length > 0 || redeemedFixedIncomes.length > 0) {
      const fixedIncomeGain = [...activeFixedIncomes, ...redeemedFixedIncomes].reduce((sum, f) => sum + f.calculation.netYield, 0);
      byClass.set("RENDA_FIXA", (byClass.get("RENDA_FIXA") ?? 0) + fixedIncomeGain);
    }
    return Array.from(byClass.entries()).map(([category, total]) => ({ category, total }));
  }

  private topMovers(
    assets: Awaited<ReturnType<AssetsService["findAll"]>>,
    fixedIncomes: Awaited<ReturnType<FixedIncomesService["findAll"]>>,
    direction: "asc" | "desc",
  ) {
    const items = [
      ...assets
        .filter((a) => a.profit !== null)
        .map((a) => ({ label: a.ticker, class: a.class, profit: a.profit as number, profitPercent: a.profitPercent as number })),
      ...fixedIncomes.map((f) => ({ label: f.institution, class: f.type, profit: f.calculation.netYield, profitPercent: f.calculation.netProfitabilityPercent })),
    ];
    items.sort((a, b) => (direction === "desc" ? b.profit - a.profit : a.profit - b.profit));
    return items.slice(0, TOP_LIST_LIMIT);
  }

  private proximosVencimentos(fixedIncomes: Awaited<ReturnType<FixedIncomesService["findAll"]>>) {
    return fixedIncomes
      .filter((f) => f.maturityDate > new Date())
      .sort((a, b) => a.maturityDate.getTime() - b.maturityDate.getTime())
      .slice(0, TOP_LIST_LIMIT)
      .map((f) => ({ id: f.id, institution: f.institution, type: f.type, maturityDate: f.maturityDate, netValue: f.calculation.netValue }));
  }

  /** Full paginated history — the timeline page. `ultimosLancamentos` above is just the top 10
   *  preview shown on the dashboard, reusing the same InvestmentAuditLog rows. */
  async history(userId: string, page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.investmentAuditLog.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.investmentAuditLog.count({ where: { userId } }),
    ]);
    return {
      items: items.map((l) => ({ id: l.id, entity: l.entity, action: l.action, changes: l.changes, createdAt: l.createdAt })),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  private async ultimosLancamentos(userId: string) {
    const logs = await this.prisma.investmentAuditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: RECENT_LAUNCHES_LIMIT,
    });
    return logs.map((l) => ({ id: l.id, entity: l.entity, action: l.action, changes: l.changes, createdAt: l.createdAt }));
  }

  private async sumIncomeByType(userId: string, types: string[]) {
    const agg = await this.prisma.investmentIncome.aggregate({
      where: { userId, type: { in: types as any } },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  /** All proventos received on stocks/FIIs/crypto — scoped by the assetId relation rather than a
   *  type list, so it also counts income the automatic BRAPI/Yahoo sync files as "OUTRO" (Yahoo
   *  never splits dividend vs. JCP, and BRAPI's own FII "Rendimento" label doesn't match
   *  classifyDividendType's DIVIDENDO/JCP checks either) — which is most of a typical portfolio's
   *  history. The Proventos calendar page already totals every type the same way; this keeps the
   *  dashboard card consistent with it instead of silently under-reporting. */
  private async sumAssetIncome(userId: string) {
    const agg = await this.prisma.investmentIncome.aggregate({
      where: { userId, assetId: { not: null }, asset: { deletedAt: null } },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount ?? 0);
  }

  /** Aportes do mês: computed automatically from what actually moved into the portfolio this
   *  month — buy transactions, new fixed-income applications, and manually logged contributions —
   *  rather than requiring a separate manual entry for it to work. */
  private async contributionsThisMonth(userId: string) {
    const start = monthStart(new Date());
    const [buyTransactions, fixedIncomeApplications, manualContributions] = await Promise.all([
      this.prisma.investmentTransaction.findMany({
        where: { userId, type: "BUY", transactionDate: { gte: start }, asset: { deletedAt: null } },
        select: { quantity: true, unitPrice: true, fees: true },
      }),
      this.prisma.investmentFixedIncome.aggregate({
        where: { userId, applicationDate: { gte: start }, deletedAt: null },
        _sum: { principalAmount: true },
      }),
      this.prisma.investmentContribution.aggregate({
        where: { userId, date: { gte: start } },
        _sum: { amount: true },
      }),
    ]);

    const buysTotal = buyTransactions.reduce((sum, t) => sum + Number(t.quantity) * Number(t.unitPrice) + Number(t.fees), 0);

    return buysTotal + Number(fixedIncomeApplications._sum.principalAmount ?? 0) + Number(manualContributions._sum.amount ?? 0);
  }

  /** Monthly cumulative net capital committed to investments (buys - sells + fixed-income
   *  applications - redemptions). This tracks money moved INTO investments over time, not a
   *  reconstructed historical market value — the app doesn't keep daily price snapshots, so a
   *  true NAV-based evolution chart isn't possible yet. `currentPatrimony` (live market value,
   *  computed today) is returned alongside so the UI can show it as the "hoje" reference point. */
  private async evolucaoPatrimonial(userId: string, currentPatrimony: number) {
    const now = new Date();
    const horizonStart = new Date(now.getFullYear(), now.getMonth() - (EVOLUTION_MONTHS - 1), 1);

    const [transactions, fixedIncomes] = await Promise.all([
      this.prisma.investmentTransaction.findMany({
        where: { userId, asset: { deletedAt: null } },
        select: { type: true, quantity: true, unitPrice: true, fees: true, transactionDate: true },
      }),
      this.prisma.investmentFixedIncome.findMany({
        where: { userId },
        select: { principalAmount: true, applicationDate: true, redeemedAt: true, redeemedNetAmount: true },
      }),
    ]);

    const flows: { date: Date; amount: number }[] = [];
    for (const t of transactions) {
      const value = Number(t.quantity) * Number(t.unitPrice) + Number(t.fees);
      flows.push({ date: t.transactionDate, amount: t.type === "BUY" ? value : -value });
    }
    for (const f of fixedIncomes) {
      flows.push({ date: f.applicationDate, amount: Number(f.principalAmount) });
      if (f.redeemedAt) flows.push({ date: f.redeemedAt, amount: -Number(f.redeemedNetAmount ?? f.principalAmount) });
    }

    const months: string[] = [];
    for (let i = 0; i < EVOLUTION_MONTHS; i++) {
      const d = new Date(horizonStart.getFullYear(), horizonStart.getMonth() + i, 1);
      months.push(monthKey(d));
    }

    const cumulativeBeforeHorizon = flows.filter((f) => f.date < horizonStart).reduce((sum, f) => sum + f.amount, 0);

    let running = cumulativeBeforeHorizon;
    const series = months.map((key) => {
      const [year, month] = key.split("-").map(Number);
      const nextMonthStart = new Date(year, month, 1);
      running += flows
        .filter((f) => f.date >= new Date(year, month - 1, 1) && f.date < nextMonthStart)
        .reduce((sum, f) => sum + f.amount, 0);
      return { month: key, capitalInvestido: Math.max(0, running) };
    });

    return { series, currentPatrimony };
  }
}
