import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  CrmCatalogRepository,
  UpsertPaymentMethodData,
  UpsertPlanData,
  UpsertPortfolioData,
  UpsertTemplateData,
} from "../domain/crm-catalog.repository";

/** O que a conta ganha na primeira visita, pra tela não abrir vazia e sem ação possível. */
const DEFAULT_PORTFOLIOS = [
  { name: "Serviço A", color: "#6366f1", order: 0 },
  { name: "Serviço B", color: "#0ea5e9", order: 1 },
];

const DEFAULT_PAYMENT_METHODS = [
  { name: "PIX", feePercent: 0, feeFixed: 0, order: 0 },
  { name: "Dinheiro", feePercent: 0, feeFixed: 0, order: 1 },
  { name: "Cartão de crédito", feePercent: 4.99, feeFixed: 0, order: 2 },
  { name: "Cartão de débito", feePercent: 1.99, feeFixed: 0, order: 3 },
  { name: "Transferência", feePercent: 0, feeFixed: 0, order: 4 },
];

const DEFAULT_ORIGINS = ["Indicação", "WhatsApp", "Instagram", "Facebook", "Google", "Site", "Revendedor", "Outros"];

const DEFAULT_TEMPLATES = [
  {
    name: "Cobrar renovação",
    category: "RENEWAL",
    body: "Olá {{nome}}, tudo bem?\n\nSua assinatura do {{servico}} vence {{data_vencimento}}.\nO valor da renovação é {{valor}}.\n\nSe quiser renovar, é só me chamar.",
    order: 0,
  },
  {
    name: "Vence hoje",
    category: "DUE",
    body: "Oi {{nome}}! Passando pra lembrar que sua assinatura do {{servico}} vence hoje.\nValor: {{valor}}.",
    order: 1,
  },
  {
    name: "Vence amanhã",
    category: "DUE",
    body: "Oi {{nome}}, tudo certo?\nSua assinatura do {{servico}} vence amanhã ({{data_vencimento}}), no valor de {{valor}}.",
    order: 2,
  },
  {
    name: "Vencido",
    category: "DELINQUENCY",
    body: "Oi {{nome}}, sua assinatura do {{servico}} venceu em {{data_vencimento}} ({{dias_para_vencer}}).\nQuer que eu reative pra você?",
    order: 3,
  },
  {
    name: "Confirmar pagamento",
    category: "RENEWAL",
    body: "Recebido, {{nome}}! ✅\nSua assinatura do {{servico}} está renovada até {{data_vencimento}}.",
    order: 4,
  },
  {
    name: "Boas-vindas",
    category: "WELCOME",
    body: "Seja bem-vindo(a), {{nome}}! 🎉\nSeu acesso ao {{servico}} já está liberado. Qualquer dúvida, é só chamar por aqui.",
    order: 5,
  },
  {
    name: "Retenção",
    category: "RETENTION",
    body: "Oi {{nome}}, vi que você está com a gente há {{meses_assinante}} e não renovou ainda.\nAconteceu alguma coisa? Se puder me contar, tento resolver.",
    order: 6,
  },
  {
    name: "Saldo baixo",
    category: "RESELLER",
    body: "Oi {{nome}}, seu saldo no {{servico}} está em {{saldo_creditos}} créditos.\nQuer que eu já deixe uma recarga separada?",
    forReseller: true,
    order: 7,
  },
  {
    name: "Confirmar recarga",
    category: "RESELLER",
    body: "Recarga confirmada, {{nome}}! ✅\n{{quantidade_creditos}} créditos adicionados no {{servico}}.\nSaldo atual: {{saldo_creditos}}.",
    forReseller: true,
    order: 8,
  },
  {
    name: "Revendedor parado",
    category: "RESELLER",
    body: "Oi {{nome}}, faz um tempo desde sua última recarga no {{servico}} ({{data_ultima_recarga}}).\nEstá tudo certo por aí?",
    forReseller: true,
    order: 9,
  },
];

@Injectable()
export class CrmCatalogPrismaRepository extends CrmCatalogRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  // -------------------------------------------------------------------------
  // Portfólios
  // -------------------------------------------------------------------------

  listPortfolios(userId: string) {
    return this.prisma.crmPortfolio.findMany({ where: { userId }, orderBy: [{ order: "asc" }, { name: "asc" }] });
  }

  findPortfolio(userId: string, id: string) {
    return this.prisma.crmPortfolio.findFirst({ where: { id, userId } });
  }

  createPortfolio(userId: string, data: UpsertPortfolioData) {
    return this.prisma.crmPortfolio.create({ data: { userId, ...data } });
  }

  updatePortfolio(id: string, data: Partial<UpsertPortfolioData>) {
    return this.prisma.crmPortfolio.update({ where: { id }, data });
  }

  /**
   * Semeia numa transação: uma conta com portfólio criado mas sem forma de pagamento deixaria a
   * primeira renovação impossível, que é justamente a operação que o módulo existe pra fazer rápido.
   */
  async seedDefaults(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const portfolios = [];
      for (const p of DEFAULT_PORTFOLIOS) {
        portfolios.push(await tx.crmPortfolio.create({ data: { userId, ...p } }));
      }

      await tx.crmPaymentMethod.createMany({
        data: DEFAULT_PAYMENT_METHODS.map((m) => ({ userId, ...m })),
        skipDuplicates: true,
      });
      await tx.crmOrigin.createMany({
        data: DEFAULT_ORIGINS.map((name, order) => ({ userId, name, order })),
        skipDuplicates: true,
      });
      await tx.crmMessageTemplate.createMany({
        data: DEFAULT_TEMPLATES.map((t) => ({ userId, ...t, category: t.category as never })),
        skipDuplicates: true,
      });
      await tx.crmSettings.upsert({ where: { userId }, create: { userId }, update: {} });

      return portfolios;
    });
  }

  // -------------------------------------------------------------------------
  // Planos
  // -------------------------------------------------------------------------

  listPlans(userId: string, portfolioId?: string) {
    return this.prisma.crmPlan.findMany({
      where: { userId, ...(portfolioId ? { portfolioId } : {}) },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
  }

  findPlan(userId: string, id: string) {
    return this.prisma.crmPlan.findFirst({ where: { id, userId } });
  }

  createPlan(userId: string, data: UpsertPlanData) {
    return this.prisma.crmPlan.create({ data: { userId, ...data, billingPeriod: data.billingPeriod as never } });
  }

  updatePlan(id: string, data: Partial<UpsertPlanData>) {
    return this.prisma.crmPlan.update({ where: { id }, data: data as Prisma.CrmPlanUpdateInput });
  }

  async deletePlan(id: string) {
    await this.prisma.crmPlan.delete({ where: { id } });
  }

  // -------------------------------------------------------------------------
  // Formas de pagamento
  // -------------------------------------------------------------------------

  listPaymentMethods(userId: string) {
    return this.prisma.crmPaymentMethod.findMany({ where: { userId }, orderBy: [{ order: "asc" }, { name: "asc" }] });
  }

  findPaymentMethod(userId: string, id: string) {
    return this.prisma.crmPaymentMethod.findFirst({ where: { id, userId } });
  }

  createPaymentMethod(userId: string, data: UpsertPaymentMethodData) {
    return this.prisma.crmPaymentMethod.create({ data: { userId, ...data } });
  }

  updatePaymentMethod(id: string, data: Partial<UpsertPaymentMethodData>) {
    return this.prisma.crmPaymentMethod.update({ where: { id }, data });
  }

  async deletePaymentMethod(id: string) {
    await this.prisma.crmPaymentMethod.delete({ where: { id } });
  }

  // -------------------------------------------------------------------------
  // Origens e tags
  // -------------------------------------------------------------------------

  listOrigins(userId: string) {
    return this.prisma.crmOrigin.findMany({ where: { userId }, orderBy: [{ order: "asc" }, { name: "asc" }] });
  }

  findOrigin(userId: string, id: string) {
    return this.prisma.crmOrigin.findFirst({ where: { id, userId } });
  }

  createOrigin(userId: string, name: string) {
    return this.prisma.crmOrigin.create({ data: { userId, name } });
  }

  updateOrigin(id: string, data: { name?: string; active?: boolean }) {
    return this.prisma.crmOrigin.update({ where: { id }, data });
  }

  async deleteOrigin(id: string) {
    await this.prisma.crmOrigin.delete({ where: { id } });
  }

  listTags(userId: string) {
    return this.prisma.crmTag.findMany({ where: { userId }, orderBy: { name: "asc" } });
  }

  findTag(userId: string, id: string) {
    return this.prisma.crmTag.findFirst({ where: { id, userId } });
  }

  createTag(userId: string, data: { name: string; color?: string }) {
    return this.prisma.crmTag.create({ data: { userId, ...data } });
  }

  async deleteTag(id: string) {
    await this.prisma.crmTag.delete({ where: { id } });
  }

  // -------------------------------------------------------------------------
  // Templates e configurações
  // -------------------------------------------------------------------------

  listTemplates(userId: string) {
    return this.prisma.crmMessageTemplate.findMany({
      where: { userId },
      orderBy: [{ order: "asc" }, { name: "asc" }],
    });
  }

  findTemplate(userId: string, id: string) {
    return this.prisma.crmMessageTemplate.findFirst({ where: { id, userId } });
  }

  createTemplate(userId: string, data: UpsertTemplateData) {
    return this.prisma.crmMessageTemplate.create({
      data: { userId, ...data, category: data.category as never },
    });
  }

  updateTemplate(id: string, data: Partial<UpsertTemplateData>) {
    return this.prisma.crmMessageTemplate.update({
      where: { id },
      data: data as Prisma.CrmMessageTemplateUpdateInput,
    });
  }

  async deleteTemplate(id: string) {
    await this.prisma.crmMessageTemplate.delete({ where: { id } });
  }

  /** Upsert em vez de findUnique: a conta sempre tem configuração, mesmo antes de alguém abrir a tela. */
  getSettings(userId: string) {
    return this.prisma.crmSettings.upsert({ where: { userId }, create: { userId }, update: {} });
  }

  updateSettings(userId: string, data: Record<string, unknown>) {
    return this.prisma.crmSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }
}
