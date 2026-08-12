import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { renderTemplate, TemplateVariables } from "../domain/message-template";
import { computeCustomerStatus } from "../domain/customer-status";
import { computeTenure } from "../domain/tenure";
import { CrmCatalogService } from "./crm-catalog.service";

/** Busca global (§50), exportação (§56) e renderização de mensagem (§18). */
@Injectable()
export class CrmSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CrmCatalogService,
  ) {}

  /** Resultados separados por categoria — misturar cliente com revendedor confundiria as ações. */
  async search(userId: string, term: string, portfolioId?: string) {
    if (!term || term.trim().length < 2) return { customers: [], leads: [], resellers: [] };

    const q = term.trim();
    const like = { contains: q, mode: "insensitive" as const };
    const portfolio = portfolioId ? { portfolioId } : {};

    const [customers, leads, resellers] = await Promise.all([
      this.prisma.crmCustomer.findMany({
        where: {
          userId,
          deletedAt: null,
          ...portfolio,
          OR: [
            { name: like },
            { nickname: like },
            { email: like },
            { phone: { contains: q } },
            { whatsapp: { contains: q } },
            { id: q },
            { tags: { some: { tag: { name: like } } } },
          ],
        },
        select: {
          id: true,
          name: true,
          phone: true,
          whatsapp: true,
          currentDueDate: true,
          manualStatus: true,
          trialEndsAt: true,
          portfolio: { select: { name: true, color: true } },
        },
        take: 20,
      }),
      this.prisma.crmLead.findMany({
        where: {
          userId,
          deletedAt: null,
          ...portfolio,
          OR: [{ name: like }, { phone: { contains: q } }, { whatsapp: { contains: q } }, { id: q }],
        },
        select: { id: true, name: true, phone: true, stage: true, portfolio: { select: { name: true, color: true } } },
        take: 20,
      }),
      this.prisma.crmReseller.findMany({
        where: {
          userId,
          deletedAt: null,
          ...(portfolioId ? { portfolios: { some: { portfolioId } } } : {}),
          OR: [
            { name: like },
            { companyName: like },
            { email: like },
            { phone: { contains: q } },
            { whatsapp: { contains: q } },
            { id: q },
            { tags: { some: { tag: { name: like } } } },
          ],
        },
        select: {
          id: true,
          name: true,
          companyName: true,
          phone: true,
          whatsapp: true,
          portfolios: { select: { id: true, portfolio: { select: { name: true, color: true } } } },
        },
        take: 20,
      }),
    ]);

    const today = new Date();
    return {
      customers: customers.map((c) => ({
        ...c,
        ...computeCustomerStatus({
          currentDueDate: c.currentDueDate,
          manualStatus: c.manualStatus as never,
          trialEndsAt: c.trialEndsAt,
          today,
        }),
      })),
      leads,
      resellers,
    };
  }

  /**
   * Monta a mensagem pronta pro WhatsApp. Devolve texto e link, e nunca envia — o disparo é sempre
   * manual, clicando (§17).
   */
  async renderMessage(userId: string, templateId: string, target: { customerId?: string; linkId?: string }) {
    const template = await this.catalog.assertTemplate(userId, templateId);
    const vars: TemplateVariables = {};
    let phone: string | null = null;

    if (target.customerId) {
      const c = await this.prisma.crmCustomer.findFirst({
        where: { id: target.customerId, userId },
        include: {
          portfolio: true,
          subscriptions: { where: { status: "ACTIVE" }, include: { plan: true }, take: 1 },
        },
      });
      if (c) {
        const sub = c.subscriptions[0];
        const status = computeCustomerStatus({
          currentDueDate: c.currentDueDate,
          manualStatus: c.manualStatus as never,
          trialEndsAt: c.trialEndsAt,
          today: new Date(),
        });
        const tenure = computeTenure(c.firstSubscribedAt, new Date());
        phone = c.whatsapp ?? c.phone;

        Object.assign(vars, {
          nome: c.nickname ?? c.name.split(" ")[0],
          servico: c.portfolio.name,
          telefone: phone,
          valor: sub ? `R$ ${Number(sub.amount).toFixed(2)}` : null,
          plano: sub?.plan?.name ?? null,
          data_vencimento: c.currentDueDate ? c.currentDueDate.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : null,
          dias_para_vencer:
            status.daysUntilDue === null
              ? null
              : status.daysUntilDue >= 0
                ? `em ${status.daysUntilDue} dia(s)`
                : `há ${status.daysLate} dia(s)`,
          meses_assinante: tenure?.label ?? null,
          forma_pagamento: sub?.paymentMethodId ? undefined : null,
        });
      }
    }

    if (target.linkId) {
      const link = await this.prisma.crmResellerPortfolio.findFirst({
        where: { id: target.linkId, userId },
        include: { reseller: true, portfolio: true },
      });
      if (link) {
        const [balance, lastRecharge] = await Promise.all([
          this.prisma.crmCreditMovement.aggregate({
            where: { userId, resellerPortfolioId: link.id },
            _sum: { quantity: true },
          }),
          this.prisma.crmRecharge.findFirst({
            where: { userId, resellerPortfolioId: link.id },
            orderBy: { date: "desc" },
          }),
        ]);
        phone = link.reseller.whatsapp ?? link.reseller.phone;

        Object.assign(vars, {
          nome: link.reseller.name.split(" ")[0],
          servico: link.portfolio.name,
          telefone: phone,
          saldo_creditos: balance._sum.quantity ?? 0,
          clientes_aproximados: link.approxActiveClients,
          quantidade_creditos: lastRecharge?.quantity ?? null,
          valor_recarga: lastRecharge ? `R$ ${Number(lastRecharge.totalAmount).toFixed(2)}` : null,
          data_ultima_recarga: lastRecharge ? lastRecharge.date.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : null,
        });
      }
    }

    const rendered = renderTemplate(template.body, vars);
    return {
      ...rendered,
      phone,
      // O link vai montado, mas quem abre é o usuário.
      whatsappUrl: phone
        ? `https://wa.me/${phone.replace(/\D/g, "").length <= 11 ? "55" : ""}${phone.replace(/\D/g, "")}?text=${encodeURIComponent(rendered.text)}`
        : null,
    };
  }

  /** CSV respeitando os filtros ativos (§56). */
  async exportCustomers(userId: string, portfolioId?: string) {
    const rows = await this.prisma.crmCustomer.findMany({
      where: { userId, deletedAt: null, ...(portfolioId ? { portfolioId } : {}) },
      include: {
        portfolio: true,
        origin: true,
        subscriptions: { where: { status: "ACTIVE" }, take: 1 },
      },
      orderBy: { name: "asc" },
    });

    const today = new Date();
    const header = [
      "Nome",
      "Telefone",
      "WhatsApp",
      "E-mail",
      "Serviço",
      "Origem",
      "Status",
      "Vencimento",
      "Dias",
      "Valor",
      "Cliente desde",
      "Tempo",
    ];

    const lines = rows.map((c) => {
      const status = computeCustomerStatus({
        currentDueDate: c.currentDueDate,
        manualStatus: c.manualStatus as never,
        trialEndsAt: c.trialEndsAt,
        hasEverSubscribed: c.subscriptions.length > 0,
        today,
      });
      const tenure = computeTenure(c.firstSubscribedAt, today);
      return [
        c.name,
        c.phone,
        c.whatsapp ?? "",
        c.email ?? "",
        c.portfolio.name,
        c.origin?.name ?? "",
        status.status,
        c.currentDueDate ? c.currentDueDate.toISOString().slice(0, 10) : "",
        String(status.daysUntilDue ?? ""),
        c.subscriptions[0] ? Number(c.subscriptions[0].amount).toFixed(2) : "",
        c.firstSubscribedAt ? c.firstSubscribedAt.toISOString().slice(0, 10) : "",
        tenure?.label ?? "",
      ];
    });

    return toCsv(header, lines);
  }

  async exportResellers(userId: string, portfolioId?: string) {
    const links = await this.prisma.crmResellerPortfolio.findMany({
      where: { userId, ...(portfolioId ? { portfolioId } : {}), reseller: { deletedAt: null } },
      include: { reseller: true, portfolio: true },
    });

    const ids = links.map((l) => l.id);
    const [balances, recharges] = await Promise.all([
      ids.length
        ? this.prisma.crmCreditMovement.groupBy({
            by: ["resellerPortfolioId"],
            where: { userId, resellerPortfolioId: { in: ids } },
            _sum: { quantity: true },
          })
        : [],
      ids.length
        ? this.prisma.crmRecharge.groupBy({
            by: ["resellerPortfolioId"],
            where: { userId, resellerPortfolioId: { in: ids } },
            _sum: { totalAmount: true },
            _count: true,
            _max: { date: true },
          })
        : [],
    ]);

    const balanceBy = new Map(balances.map((b) => [b.resellerPortfolioId, b._sum.quantity ?? 0]));
    const rechargeBy = new Map(recharges.map((r) => [r.resellerPortfolioId, r]));

    const header = [
      "Revendedor",
      "Nome comercial",
      "Telefone",
      "Serviço",
      "Status",
      "Créditos",
      "Clientes aprox. (estimativa)",
      "Recargas",
      "Total gasto",
      "Última recarga",
    ];

    const lines = links.map((l) => {
      const r = rechargeBy.get(l.id);
      return [
        l.reseller.name,
        l.reseller.companyName ?? "",
        l.reseller.phone,
        l.portfolio.name,
        l.status,
        String(balanceBy.get(l.id) ?? 0),
        String(l.approxActiveClients),
        String(r?._count ?? 0),
        Number(r?._sum.totalAmount ?? 0).toFixed(2),
        r?._max.date ? r._max.date.toISOString().slice(0, 10) : "",
      ];
    });

    return toCsv(header, lines);
  }
}

/** Escapa aspas e separadores — nome com vírgula quebraria a coluna seguinte. */
function toCsv(header: string[], rows: string[][]): string {
  const escape = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [header, ...rows].map((r) => r.map(escape).join(";")).join("\n");
}
