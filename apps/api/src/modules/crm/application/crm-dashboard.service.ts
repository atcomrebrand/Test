import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { classifyResellerActivity, isLowCredit } from "../domain/credit-ledger";
import { DELINQUENT_AFTER_DAYS } from "../domain/customer-status";
import { averageTicket, combineRevenue, computeChurn, computeRetentionCohorts } from "../domain/revenue";
import { computeProfit, CrmCurrency, groupRevenueByCurrency } from "../domain/panel-credits";
import { CrmCatalogService } from "./crm-catalog.service";
import { CrmPanelService } from "./crm-panel.service";

export type PeriodKey = "today" | "month" | "lastMonth" | "3m" | "6m" | "12m" | "custom";

function startOfDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDays(d: Date, n: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
}
function addMonths(d: Date, n: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()));
}
const num = (v: Prisma.Decimal | null | undefined) => Number(v ?? 0);

/** Resolve o seletor de período (§5) numa janela de datas. */
export function resolvePeriod(period: PeriodKey, from?: string, to?: string): { from: Date; to: Date } {
  const today = startOfDay(new Date());
  switch (period) {
    case "today":
      return { from: today, to: addDays(today, 1) };
    case "lastMonth": {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      return { from: start, to: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)) };
    }
    case "3m":
      return { from: addMonths(today, -3), to: addDays(today, 1) };
    case "6m":
      return { from: addMonths(today, -6), to: addDays(today, 1) };
    case "12m":
      return { from: addMonths(today, -12), to: addDays(today, 1) };
    case "custom":
      return {
        from: from ? new Date(from) : addMonths(today, -1),
        to: to ? addDays(new Date(to), 1) : addDays(today, 1),
      };
    case "month":
    default:
      return { from: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), to: addDays(today, 1) };
  }
}

/**
 * Todos os indicadores do módulo.
 *
 * Regra que vale pra este arquivo inteiro: nada aqui carrega lista pra contar em JS. Cada número é
 * um `count`, `aggregate` ou `groupBy` no Postgres. O dashboard abre a cada visita e a VPS tem 1GB —
 * foi assim que a Home quebrou antes, carregando financiamentos duas vezes só pra somar.
 */
@Injectable()
export class CrmDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CrmCatalogService,
    private readonly panel: CrmPanelService,
  ) {}

  private scope(userId: string, portfolioId?: string): Prisma.CrmCustomerWhereInput {
    return { userId, deletedAt: null, ...(portfolioId ? { portfolioId } : {}) };
  }

  /** Contagens de cliente (§4). Uma query por indicador, todas por índice. */
  async customerIndicators(userId: string, portfolioId?: string) {
    const today = startOfDay(new Date());
    const base = this.scope(userId, portfolioId);
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

    const inWindow = (days: number): Prisma.CrmCustomerWhereInput => ({
      ...base,
      manualStatus: null,
      currentDueDate: { gte: today, lte: addDays(today, days) },
    });

    const [
      total,
      dueToday,
      dueTomorrow,
      due3,
      due7,
      due30,
      late,
      delinquent,
      trial,
      cancelled,
      inactive,
      newThisMonth,
      recovered,
      active,
    ] = await Promise.all([
      this.prisma.crmCustomer.count({ where: base }),
      this.prisma.crmCustomer.count({ where: inWindow(0) }),
      this.prisma.crmCustomer.count({
        where: { ...base, manualStatus: null, currentDueDate: { gte: addDays(today, 1), lte: addDays(today, 1) } },
      }),
      this.prisma.crmCustomer.count({ where: inWindow(3) }),
      this.prisma.crmCustomer.count({ where: inWindow(7) }),
      this.prisma.crmCustomer.count({ where: inWindow(30) }),
      // Atrasado é até 7 dias; passou disso vira inadimplente. As duas janelas não se sobrepõem.
      this.prisma.crmCustomer.count({
        where: {
          ...base,
          manualStatus: null,
          currentDueDate: { gte: addDays(today, -DELINQUENT_AFTER_DAYS), lt: today },
        },
      }),
      this.prisma.crmCustomer.count({
        where: { ...base, manualStatus: null, currentDueDate: { lt: addDays(today, -DELINQUENT_AFTER_DAYS) } },
      }),
      this.prisma.crmCustomer.count({ where: { ...base, trialEndsAt: { gte: today } } }),
      this.prisma.crmCustomer.count({ where: { ...base, manualStatus: "CANCELLED" } }),
      this.prisma.crmCustomer.count({ where: { ...base, manualStatus: "INACTIVE" } }),
      this.prisma.crmCustomer.count({ where: { ...base, createdAt: { gte: monthStart } } }),
      this.prisma.crmCustomer.count({ where: { ...base, manualStatus: "RECOVERY" } }),
      this.prisma.crmCustomer.count({
        where: { ...base, manualStatus: null, currentDueDate: { gte: today } },
      }),
    ]);

    return {
      total,
      active,
      dueToday,
      dueTomorrow,
      dueIn3Days: due3,
      dueIn7Days: due7,
      dueIn30Days: due30,
      late,
      delinquent,
      trial,
      cancelled,
      inactive,
      newThisMonth,
      recovered,
      lost: cancelled + inactive,
    };
  }

  /**
   * Financeiro (§5, §55). As duas origens vêm de tabelas diferentes e são devolvidas separadas
   * junto com o total — nunca só o total, senão parece que tudo veio do mesmo lugar.
   */
  async financial(userId: string, portfolioId: string | undefined, period: PeriodKey, from?: string, to?: string) {
    const window = resolvePeriod(period, from, to);
    const portfolioFilter = portfolioId ? { portfolioId } : {};

    const [payments, recharges, byMethod, byPlan, pendingCustomers] = await Promise.all([
      this.prisma.crmPayment.aggregate({
        where: { userId, reversedAt: null, ...portfolioFilter, paidAt: { gte: window.from, lt: window.to } },
        _sum: { grossAmount: true, feeAmount: true, netAmount: true },
        _count: true,
      }),
      this.prisma.crmRecharge.aggregate({
        where: { userId, ...portfolioFilter, date: { gte: window.from, lt: window.to } },
        _sum: { totalAmount: true, feeAmount: true, netAmount: true },
        _count: true,
      }),
      this.prisma.crmPayment.groupBy({
        by: ["paymentMethodName"],
        where: { userId, reversedAt: null, ...portfolioFilter, paidAt: { gte: window.from, lt: window.to } },
        _sum: { grossAmount: true },
        _count: true,
      }),
      this.prisma.crmSubscription.groupBy({
        by: ["planId"],
        where: { userId, status: "ACTIVE", ...portfolioFilter },
        _sum: { amount: true },
        _count: true,
      }),
      // Receita pendente: o que está vencido e ainda não entrou.
      this.prisma.crmSubscription.aggregate({
        where: {
          userId,
          status: "ACTIVE",
          ...portfolioFilter,
          dueDate: { lt: startOfDay(new Date()) },
          customer: { deletedAt: null, manualStatus: null },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const direct = num(payments._sum.grossAmount);
    const reseller = num(recharges._sum.totalAmount);
    const fees = num(payments._sum.feeAmount) + num(recharges._sum.feeAmount);
    const net = num(payments._sum.netAmount) + num(recharges._sum.netAmount);

    const plans = await this.prisma.crmPlan.findMany({ where: { userId } });
    const planName = new Map(plans.map((p) => [p.id, p.name]));

    return {
      period,
      from: window.from,
      to: window.to,
      revenue: combineRevenue(direct, reseller),
      gross: Math.round((direct + reseller) * 100) / 100,
      fees: Math.round(fees * 100) / 100,
      net: Math.round(net * 100) / 100,
      pending: { amount: num(pendingCustomers._sum.amount), count: pendingCustomers._count },
      paymentsCount: payments._count,
      rechargesCount: recharges._count,
      averageTicket: averageTicket(direct, payments._count),
      averageRechargeTicket: averageTicket(reseller, recharges._count),
      byPaymentMethod: byMethod
        .map((m) => ({ name: m.paymentMethodName ?? "Sem forma", total: num(m._sum.grossAmount), count: m._count }))
        .sort((a, b) => b.total - a.total),
      byPlan: byPlan
        .map((p) => ({
          planId: p.planId,
          name: p.planId ? (planName.get(p.planId) ?? "—") : "Sem plano",
          monthlyRecurring: num(p._sum.amount),
          count: p._count,
        }))
        .sort((a, b) => b.monthlyRecurring - a.monthlyRecurring),
    };
  }

  /**
   * Receita por moeda e lucro real (decisão: nunca somar real com dólar).
   *
   * Calcula serviço a serviço e só então agrupa por moeda, porque a moeda é do serviço. O lucro
   * desconta as taxas E o que os créditos consumidos custaram — sem isso, "receita" parece lucro,
   * quando na verdade cada renovação já saiu com um custo embutido.
   */
  async financialByCurrency(
    userId: string,
    portfolioId: string | undefined,
    period: PeriodKey,
    from?: string,
    to?: string,
  ) {
    const window = resolvePeriod(period, from, to);
    const all = await this.catalog.listPortfolios(userId);
    const portfolios = portfolioId ? all.filter((p) => p.id === portfolioId) : all;
    const ids = portfolios.map((p) => p.id);

    const [payments, recharges, consumed, prices] = await Promise.all([
      this.prisma.crmPayment.groupBy({
        by: ["portfolioId"],
        where: { userId, reversedAt: null, portfolioId: { in: ids }, paidAt: { gte: window.from, lt: window.to } },
        _sum: { grossAmount: true, feeAmount: true },
      }),
      this.prisma.crmRecharge.groupBy({
        by: ["portfolioId"],
        where: { userId, portfolioId: { in: ids }, date: { gte: window.from, lt: window.to } },
        _sum: { totalAmount: true, feeAmount: true },
      }),
      this.panel.consumedInPeriod(userId, ids, window.from, window.to),
      this.panel.averagePrices(userId, ids),
    ]);

    const paymentBy = new Map(payments.map((p) => [p.portfolioId, p]));
    const rechargeBy = new Map(recharges.map((r) => [r.portfolioId, r]));

    const perPortfolio = portfolios.map((p) => {
      const pay = paymentBy.get(p.id);
      const rec = rechargeBy.get(p.id);
      const direct = num(pay?._sum.grossAmount);
      const resellerRevenue = num(rec?._sum.totalAmount);
      const fees = num(pay?._sum.feeAmount) + num(rec?._sum.feeAmount);
      const creditsConsumed = consumed.get(p.id) ?? 0;

      return {
        portfolio: p,
        currency: p.currency as CrmCurrency,
        direct,
        reseller: resellerRevenue,
        creditsConsumed,
        averageCreditPrice: prices.get(p.id) ?? null,
        ...computeProfit({
          grossRevenue: direct + resellerRevenue,
          fees,
          creditsConsumed,
          averageCreditPrice: prices.get(p.id) ?? null,
        }),
      };
    });

    // Um bloco por moeda. Somar tudo num número só juntaria grandezas diferentes — o mesmo erro que
    // a soma de churns cometeria.
    const byCurrency = groupRevenueByCurrency(
      perPortfolio.map((p) => ({ currency: p.currency, direct: p.direct, reseller: p.reseller })),
    ).map((bucket) => {
      const doMesmo = perPortfolio.filter((p) => p.currency === bucket.currency);
      const round = (v: number) => Math.round(v * 100) / 100;
      return {
        ...bucket,
        fees: round(doMesmo.reduce((s, p) => s + p.fees, 0)),
        creditCost: round(doMesmo.reduce((s, p) => s + p.creditCost, 0)),
        profit: round(doMesmo.reduce((s, p) => s + p.profit, 0)),
        creditsConsumed: doMesmo.reduce((s, p) => s + p.creditsConsumed, 0),
        // Se qualquer serviço da moeda tem custo desconhecido, a margem do bloco está otimista.
        costUnknown: doMesmo.some((p) => p.costUnknown),
      };
    });

    return { period, from: window.from, to: window.to, byCurrency, perPortfolio };
  }

  /** Painel de vencimentos (§6): as janelas com os clientes de cada uma, prontos pra ação rápida. */
  async dueBoard(userId: string, portfolioId?: string) {
    const today = startOfDay(new Date());
    const base = this.scope(userId, portfolioId);

    const select = {
      id: true,
      name: true,
      nickname: true,
      phone: true,
      whatsapp: true,
      currentDueDate: true,
      portfolioId: true,
      portfolio: { select: { name: true, color: true } },
      subscriptions: {
        where: { status: "ACTIVE" as const },
        select: { id: true, amount: true, billingPeriod: true, planId: true },
        take: 1,
      },
    };

    const [hoje, amanha, ate3, ate7, ate30, atrasados] = await Promise.all([
      this.prisma.crmCustomer.findMany({
        where: { ...base, manualStatus: null, currentDueDate: { gte: today, lte: today } },
        select,
        orderBy: { name: "asc" },
      }),
      this.prisma.crmCustomer.findMany({
        where: { ...base, manualStatus: null, currentDueDate: { gte: addDays(today, 1), lte: addDays(today, 1) } },
        select,
        orderBy: { name: "asc" },
      }),
      this.prisma.crmCustomer.count({
        where: { ...base, manualStatus: null, currentDueDate: { gte: today, lte: addDays(today, 3) } },
      }),
      this.prisma.crmCustomer.count({
        where: { ...base, manualStatus: null, currentDueDate: { gte: today, lte: addDays(today, 7) } },
      }),
      this.prisma.crmCustomer.count({
        where: { ...base, manualStatus: null, currentDueDate: { gte: today, lte: addDays(today, 30) } },
      }),
      this.prisma.crmCustomer.findMany({
        where: { ...base, manualStatus: null, currentDueDate: { lt: today } },
        select,
        orderBy: { currentDueDate: "asc" },
        take: 100,
      }),
    ]);

    return {
      today: { count: hoje.length, customers: hoje },
      tomorrow: { count: amanha.length, customers: amanha },
      next3Days: { count: ate3 },
      next7Days: { count: ate7 },
      next30Days: { count: ate30 },
      late: { count: atrasados.length, customers: atrasados },
    };
  }

  /** Dashboard de revendedores (§42). */
  async resellerIndicators(userId: string, portfolioId?: string) {
    const links = await this.prisma.crmResellerPortfolio.findMany({
      where: { userId, ...(portfolioId ? { portfolioId } : {}), reseller: { deletedAt: null } },
      include: { reseller: { select: { id: true, name: true } }, portfolio: { select: { name: true, color: true } } },
    });

    if (links.length === 0) {
      return {
        total: 0,
        active: 0,
        inactive: 0,
        attention: 0,
        lowCredit: 0,
        creditsSold: 0,
        creditsUsed: 0,
        creditsAvailable: 0,
        totalRecharges: 0,
        rechargeRevenue: 0,
        averageRechargeTicket: null,
        averageCreditsPerRecharge: null,
        approxActiveClients: 0,
        ranking: [],
      };
    }

    const ids = links.map((l) => l.id);
    const settings = await this.catalog.getSettings(userId);

    const [balances, positives, negatives, recharges] = await Promise.all([
      this.prisma.crmCreditMovement.groupBy({
        by: ["resellerPortfolioId"],
        where: { userId, resellerPortfolioId: { in: ids } },
        _sum: { quantity: true },
      }),
      this.prisma.crmCreditMovement.aggregate({
        where: { userId, resellerPortfolioId: { in: ids }, quantity: { gte: 0 } },
        _sum: { quantity: true },
      }),
      this.prisma.crmCreditMovement.aggregate({
        where: { userId, resellerPortfolioId: { in: ids }, quantity: { lt: 0 } },
        _sum: { quantity: true },
      }),
      this.prisma.crmRecharge.groupBy({
        by: ["resellerPortfolioId"],
        where: { userId, resellerPortfolioId: { in: ids } },
        _sum: { totalAmount: true, quantity: true },
        _count: true,
        _max: { date: true },
      }),
    ]);

    const balanceBy = new Map(balances.map((b) => [b.resellerPortfolioId, b._sum.quantity ?? 0]));
    const rechargeBy = new Map(recharges.map((r) => [r.resellerPortfolioId, r]));
    const today = new Date();

    let active = 0;
    let attention = 0;
    let inactive = 0;
    let lowCredit = 0;

    const ranking = links.map((link) => {
      const balance = balanceBy.get(link.id) ?? 0;
      const r = rechargeBy.get(link.id);
      const { activity } = classifyResellerActivity({
        lastRechargeAt: r?._max.date ?? null,
        today,
        attentionDays: settings.resellerAttentionDays,
        inactiveDays: settings.resellerInactiveDays,
      });

      if (activity === "ACTIVE") active += 1;
      else if (activity === "ATTENTION") attention += 1;
      else inactive += 1;
      if (isLowCredit({ balance, threshold: link.lowCreditThreshold })) lowCredit += 1;

      return {
        resellerId: link.reseller.id,
        resellerName: link.reseller.name,
        linkId: link.id,
        portfolioId: link.portfolioId,
        // O ranking é por vínculo, não por pessoa: em "Todos", o mesmo revendedor aparece uma vez
        // por serviço, e sem o nome do serviço as duas linhas pareceriam duplicata.
        portfolioName: link.portfolio.name,
        portfolioColor: link.portfolio.color,
        balance,
        totalSpent: num(r?._sum.totalAmount),
        creditsPurchased: r?._sum.quantity ?? 0,
        recharges: r?._count ?? 0,
        approxActiveClients: link.approxActiveClients,
        lastRechargeAt: r?._max.date ?? null,
        activity,
      };
    });

    const totalSpent = ranking.reduce((s, r) => s + r.totalSpent, 0);
    const totalRecharges = ranking.reduce((s, r) => s + r.recharges, 0);
    const creditsSold = ranking.reduce((s, r) => s + r.creditsPurchased, 0);

    return {
      total: links.length,
      active,
      attention,
      inactive,
      lowCredit,
      creditsSold,
      creditsUsed: -(negatives._sum.quantity ?? 0),
      creditsAvailable: positives._sum.quantity! + (negatives._sum.quantity ?? 0),
      totalRecharges,
      rechargeRevenue: Math.round(totalSpent * 100) / 100,
      averageRechargeTicket: averageTicket(totalSpent, totalRecharges),
      averageCreditsPerRecharge: totalRecharges > 0 ? Math.round((creditsSold / totalRecharges) * 100) / 100 : null,
      // Estimativa, nunca contagem: a UI é obrigada a rotular como tal (§37, §44).
      approxActiveClients: ranking.reduce((s, r) => s + r.approxActiveClients, 0),
      ranking: ranking.sort((a, b) => b.totalSpent - a.totalSpent),
    };
  }

  /**
   * Comparação dos dois serviços (§54). Cada portfólio é calculado inteiro — churn de "todos" não é
   * média de churns, então não dá pra somar depois.
   */
  async comparison(userId: string) {
    const portfolios = await this.catalog.listPortfolios(userId);

    return Promise.all(
      portfolios.map(async (p) => {
        const [customers, resellers, financial, churn] = await Promise.all([
          this.customerIndicators(userId, p.id),
          this.resellerIndicators(userId, p.id),
          this.financial(userId, p.id, "month"),
          this.churn(userId, p.id),
        ]);

        return {
          portfolio: p,
          customers: customers.total,
          activeCustomers: customers.active,
          resellers: resellers.total,
          estimatedResellerClients: resellers.approxActiveClients,
          revenue: financial.revenue,
          churnRate: churn.churnRate,
          netGrowth: churn.netGrowth,
        };
      }),
    );
  }

  /** Churn do mês corrente (§25). */
  async churn(userId: string, portfolioId?: string) {
    const today = startOfDay(new Date());
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const base = this.scope(userId, portfolioId);

    const [startActive, lost, gained] = await Promise.all([
      // Base do início do mês: quem já existia antes e não foi cancelado depois.
      this.prisma.crmCustomer.count({ where: { ...base, createdAt: { lt: monthStart } } }),
      this.prisma.crmCustomer.count({
        where: { ...base, manualStatus: { in: ["CANCELLED", "INACTIVE"] }, updatedAt: { gte: monthStart } },
      }),
      this.prisma.crmCustomer.count({ where: { ...base, createdAt: { gte: monthStart } } }),
    ]);

    return computeChurn({ startActive, lost, gained });
  }

  /** Coortes de retenção (§26). */
  async retention(userId: string, portfolioId?: string) {
    const rows = await this.prisma.crmCustomer.findMany({
      where: { ...this.scope(userId, portfolioId), firstSubscribedAt: { not: null } },
      select: { firstSubscribedAt: true, manualStatus: true, updatedAt: true },
    });

    const members = rows.map((r) => ({
      startedAt: r.firstSubscribedAt!,
      // Cancelado/inativo saiu; a data de saída é a última alteração, que é quando o status mudou.
      endedAt: r.manualStatus === "CANCELLED" || r.manualStatus === "INACTIVE" ? r.updatedAt : null,
    }));

    return computeRetentionCohorts(members, startOfDay(new Date()));
  }

  /** Fila de recuperação (§24): quem venceu, do mais antigo pro mais recente. */
  async retentionQueue(userId: string, portfolioId?: string) {
    const today = startOfDay(new Date());
    return this.prisma.crmCustomer.findMany({
      where: { ...this.scope(userId, portfolioId), currentDueDate: { lt: today } },
      select: {
        id: true,
        name: true,
        phone: true,
        whatsapp: true,
        currentDueDate: true,
        manualStatus: true,
        firstSubscribedAt: true,
        vip: true,
        portfolio: { select: { name: true, color: true } },
        subscriptions: { where: { status: "ACTIVE" }, select: { id: true, amount: true }, take: 1 },
      },
      orderBy: { currentDueDate: "asc" },
      take: 200,
    });
  }

  /** Alertas do topo do dashboard (§28, §40). */
  async alerts(userId: string, portfolioId?: string) {
    const [customers, resellers, financial] = await Promise.all([
      this.customerIndicators(userId, portfolioId),
      this.resellerIndicators(userId, portfolioId),
      this.financial(userId, portfolioId, "month"),
    ]);

    // `id` é a identidade da linha; `kind` é o **tipo** dela e pode repetir — PANEL_LOW_CREDIT sai
    // um por serviço. Sem separar os dois, a tela usava o tipo como chave de lista e o React
    // reclamava de chave duplicada (e trocaria os alertas de lugar entre atualizações).
    const alerts: { id: string; kind: string; tone: "info" | "warning" | "danger"; message: string }[] = [];

    if (customers.dueTomorrow > 0) {
      alerts.push({
        id: "DUE_TOMORROW",
        kind: "DUE_TOMORROW",
        tone: "warning",
        message: `${customers.dueTomorrow} cliente(s) vencem amanhã.`,
      });
    }
    if (customers.delinquent > 0) {
      alerts.push({
        id: "DELINQUENT",
        kind: "DELINQUENT",
        tone: "danger",
        message: `${customers.delinquent} cliente(s) estão vencidos há mais de ${DELINQUENT_AFTER_DAYS} dias.`,
      });
    }
    if (financial.pending.amount > 0) {
      alerts.push({
        id: "PENDING_REVENUE",
        kind: "PENDING_REVENUE",
        tone: "warning",
        message: `Você tem R$ ${financial.pending.amount.toFixed(2)} em pagamentos pendentes.`,
      });
    }
    if (resellers.lowCredit > 0) {
      alerts.push({
        id: "LOW_CREDIT",
        kind: "LOW_CREDIT",
        tone: "warning",
        message: `${resellers.lowCredit} revendedor(es) com saldo baixo.`,
      });
    }
    if (resellers.inactive > 0) {
      alerts.push({
        id: "RESELLER_INACTIVE",
        kind: "RESELLER_INACTIVE",
        tone: "info",
        message: `${resellers.inactive} revendedor(es) sem recarga há muito tempo.`,
      });
    }

    return alerts;
  }

  /** Tudo que o dashboard precisa, numa chamada — evita 6 round-trips do frontend. */
  async overview(userId: string, portfolioId: string | undefined, period: PeriodKey, from?: string, to?: string) {
    if (portfolioId) await this.catalog.assertPortfolio(userId, portfolioId);

    const portfolios = await this.catalog.listPortfolios(userId);
    const ids = portfolioId ? [portfolioId] : portfolios.map((p) => p.id);

    const [customers, financial, byCurrency, dueBoard, resellers, churn, alerts, panelBalances, settings] =
      await Promise.all([
        this.customerIndicators(userId, portfolioId),
        this.financial(userId, portfolioId, period, from, to),
        this.financialByCurrency(userId, portfolioId, period, from, to),
        this.dueBoard(userId, portfolioId),
        this.resellerIndicators(userId, portfolioId),
        this.churn(userId, portfolioId),
        this.alerts(userId, portfolioId),
        this.panel.balances(userId, ids),
        this.catalog.getSettings(userId),
      ]);

    const panel = portfolios
      .filter((p) => ids.includes(p.id))
      .map((p) => {
        const balance = panelBalances.get(p.id) ?? 0;
        return {
          portfolio: p,
          currency: p.currency as CrmCurrency,
          balance,
          lowCredit: balance <= settings.panelLowCreditThreshold,
        };
      });

    // Estoque acabando entra como alerta de primeira linha: sem crédito a renovação é bloqueada, e
    // descobrir isso com o cliente esperando é o pior momento possível.
    const panelAlerts = panel
      .filter((p) => p.lowCredit)
      .map((p) => ({
        // Discriminado pelo serviço: dois painéis com saldo baixo são dois alertas distintos.
        id: `PANEL_LOW_CREDIT:${p.portfolio.id}`,
        kind: "PANEL_LOW_CREDIT",
        tone: (p.balance <= 0 ? "danger" : "warning") as "danger" | "warning",
        message:
          p.balance <= 0
            ? `${p.portfolio.name}: sem créditos no painel — as renovações estão bloqueadas.`
            : `${p.portfolio.name}: só ${p.balance} crédito(s) no painel.`,
      }));

    return {
      customers,
      financial,
      byCurrency: byCurrency.byCurrency,
      perPortfolio: byCurrency.perPortfolio,
      dueBoard,
      resellers,
      churn,
      panel,
      alerts: [...panelAlerts, ...alerts],
    };
  }
}
