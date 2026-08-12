import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  CreateCustomerData,
  CrmCustomerRepository,
  CustomerFilters,
  RenewData,
} from "../domain/crm-customer.repository";

const CUSTOMER_INCLUDE = {
  portfolio: true,
  origin: true,
  tags: { include: { tag: true } },
  subscriptions: { include: { plan: true }, orderBy: { startDate: "desc" } },
} satisfies Prisma.CrmCustomerInclude;

/** Meia-noite UTC do dia — as janelas de vencimento comparam calendário, não instante. */
function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days),
  );
}

@Injectable()
export class CrmCustomerPrismaRepository extends CrmCustomerRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * As janelas de vencimento viram range no `currentDueDate`, que é indexado — é o que mantém o
   * painel de vencimentos barato mesmo com a base inteira, em vez de carregar todo mundo e filtrar
   * em JS.
   */
  list(userId: string, filters: CustomerFilters) {
    const today = startOfDay(new Date());

    const where: Prisma.CrmCustomerWhereInput = {
      userId,
      ...(filters.includeDeleted ? {} : { deletedAt: null }),
      ...(filters.portfolioId ? { portfolioId: filters.portfolioId } : {}),
      ...(filters.originId ? { originId: filters.originId } : {}),
      ...(filters.dueWithinDays !== undefined
        ? { currentDueDate: { gte: today, lte: addDays(today, filters.dueWithinDays) } }
        : {}),
      ...(filters.onlyLate ? { currentDueDate: { lt: today } } : {}),
      ...(filters.tagIds?.length ? { tags: { some: { tagId: { in: filters.tagIds } } } } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { nickname: { contains: filters.search, mode: "insensitive" } },
              { phone: { contains: filters.search } },
              { whatsapp: { contains: filters.search } },
              { email: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return this.prisma.crmCustomer.findMany({
      where,
      include: CUSTOMER_INCLUDE,
      orderBy: [{ currentDueDate: "asc" }, { name: "asc" }],
    });
  }

  findById(userId: string, id: string) {
    return this.prisma.crmCustomer.findFirst({ where: { id, userId }, include: CUSTOMER_INCLUDE });
  }

  create(userId: string, data: CreateCustomerData) {
    const { tagIds, ...rest } = data;
    return this.prisma.crmCustomer.create({
      data: {
        userId,
        ...rest,
        ...(tagIds?.length ? { tags: { create: tagIds.map((tagId) => ({ tagId })) } } : {}),
      },
      include: CUSTOMER_INCLUDE,
    });
  }

  async update(id: string, data: Record<string, unknown>, tagIds?: string[]) {
    if (tagIds) {
      // Substitui o conjunto inteiro: a UI manda a lista final, não um delta.
      await this.prisma.crmCustomerTag.deleteMany({ where: { customerId: id } });
      if (tagIds.length) {
        await this.prisma.crmCustomerTag.createMany({ data: tagIds.map((tagId) => ({ customerId: id, tagId })) });
      }
    }
    return this.prisma.crmCustomer.update({
      where: { id },
      data: data as Prisma.CrmCustomerUpdateInput,
      include: CUSTOMER_INCLUDE,
    });
  }

  async softDelete(id: string) {
    await this.prisma.crmCustomer.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // -------------------------------------------------------------------------
  // Assinaturas
  // -------------------------------------------------------------------------

  listSubscriptions(userId: string, customerId: string) {
    return this.prisma.crmSubscription.findMany({
      where: { userId, customerId },
      include: { plan: true },
      orderBy: { startDate: "desc" },
    });
  }

  findSubscription(userId: string, id: string) {
    return this.prisma.crmSubscription.findFirst({ where: { id, userId }, include: { plan: true } });
  }

  findActiveSubscription(userId: string, customerId: string) {
    return this.prisma.crmSubscription.findFirst({
      where: { userId, customerId, status: "ACTIVE" },
      include: { plan: true },
      orderBy: { dueDate: "desc" },
    });
  }

  createSubscription(userId: string, data: Record<string, unknown>) {
    return this.prisma.crmSubscription.create({
      data: { userId, ...data } as Prisma.CrmSubscriptionUncheckedCreateInput,
      include: { plan: true },
    });
  }

  updateSubscription(id: string, data: Record<string, unknown>) {
    return this.prisma.crmSubscription.update({
      where: { id },
      data: data as Prisma.CrmSubscriptionUpdateInput,
      include: { plan: true },
    });
  }

  /**
   * A operação mais usada do módulo, e a que mais precisa ser atômica: pagamento + novo vencimento
   * da assinatura + vencimento desnormalizado do cliente + evento de timeline. Se o pagamento
   * gravasse e o vencimento não, o cliente pagaria e seguiria vencido na tela.
   */
  async renew(data: RenewData) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.crmPayment.create({
        data: {
          userId: data.userId,
          customerId: data.customerId,
          subscriptionId: data.subscriptionId,
          portfolioId: data.portfolioId,
          paidAt: data.paidAt,
          grossAmount: data.amount,
          feePercent: data.feePercent,
          feeFixed: data.feeFixed,
          feeAmount: data.feeAmount,
          netAmount: data.netAmount,
          paymentMethodId: data.paymentMethodId,
          paymentMethodName: data.paymentMethodName,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          notes: data.notes,
        },
      });

      const subscription = await tx.crmSubscription.update({
        where: { id: data.subscriptionId },
        data: {
          dueDate: data.nextDueDate,
          lastPaymentAt: data.paidAt,
          amount: data.amount,
          status: "ACTIVE",
          ...(data.paymentMethodId ? { paymentMethodId: data.paymentMethodId } : {}),
        },
        include: { plan: true },
      });

      await tx.crmCustomer.update({
        where: { id: data.customerId },
        data: {
          currentDueDate: data.nextDueDate,
          // Renovar tira o cliente de cancelado/inativo: o pagamento é a evidência mais forte que
          // existe de que a relação voltou, e deixar o override manual valendo esconderia isso.
          manualStatus: null,
          ...(data.firstSubscribedAt ? { firstSubscribedAt: data.firstSubscribedAt } : {}),
        },
      });

      await tx.crmCustomerEvent.create({
        data: {
          userId: data.userId,
          customerId: data.customerId,
          kind: "RENEWAL",
          description: "Assinatura renovada",
          amount: data.amount,
        },
      });

      return { subscription, payment };
    });
  }

  // -------------------------------------------------------------------------
  // Pagamentos
  // -------------------------------------------------------------------------

  listPayments(userId: string, customerId: string) {
    return this.prisma.crmPayment.findMany({ where: { userId, customerId }, orderBy: { paidAt: "desc" } });
  }

  findPayment(userId: string, id: string) {
    return this.prisma.crmPayment.findFirst({ where: { id, userId } });
  }

  createPayment(userId: string, data: Record<string, unknown>) {
    return this.prisma.crmPayment.create({ data: { userId, ...data } as Prisma.CrmPaymentUncheckedCreateInput });
  }

  /** Estorno marca a linha, nunca apaga — o histórico financeiro não encolhe (§62). */
  reversePayment(id: string) {
    return this.prisma.crmPayment.update({ where: { id }, data: { reversedAt: new Date() } });
  }

  /**
   * Receita do cliente por janela. Quatro agregados no banco em vez de carregar todos os pagamentos
   * e somar em JS — o perfil de um cliente antigo tem dezenas de linhas e essa tela abre a cada
   * clique na lista.
   */
  async computeRevenue(userId: string, customerId: string, today: Date) {
    const base: Prisma.CrmPaymentWhereInput = { userId, customerId, reversedAt: null };

    const [all, l30, l6, l12, bounds] = await Promise.all([
      this.prisma.crmPayment.aggregate({
        where: base,
        _sum: { grossAmount: true, feeAmount: true, netAmount: true },
        _count: true,
      }),
      this.prisma.crmPayment.aggregate({ where: { ...base, paidAt: { gte: addDays(today, -30) } }, _sum: { grossAmount: true } }),
      this.prisma.crmPayment.aggregate({ where: { ...base, paidAt: { gte: addDays(today, -182) } }, _sum: { grossAmount: true } }),
      this.prisma.crmPayment.aggregate({ where: { ...base, paidAt: { gte: addDays(today, -365) } }, _sum: { grossAmount: true } }),
      this.prisma.crmPayment.aggregate({ where: base, _min: { paidAt: true }, _max: { paidAt: true } }),
    ]);

    const num = (v: Prisma.Decimal | null | undefined) => Number(v ?? 0);

    return {
      total: num(all._sum.grossAmount),
      last30: num(l30._sum.grossAmount),
      last6Months: num(l6._sum.grossAmount),
      last12Months: num(l12._sum.grossAmount),
      gross: num(all._sum.grossAmount),
      fees: num(all._sum.feeAmount),
      net: num(all._sum.netAmount),
      count: all._count,
      firstPaymentAt: bounds._min.paidAt ?? null,
      lastPaymentAt: bounds._max.paidAt ?? null,
    };
  }

  // -------------------------------------------------------------------------
  // Timeline
  // -------------------------------------------------------------------------

  listEvents(userId: string, customerId: string) {
    return this.prisma.crmCustomerEvent.findMany({
      where: { userId, customerId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  addEvent(userId: string, customerId: string, kind: string, description: string, amount?: number | null) {
    return this.prisma.crmCustomerEvent.create({
      data: { userId, customerId, kind, description, amount: amount ?? null },
    });
  }

  countRenewals(userId: string, customerId: string) {
    return this.prisma.crmPayment.count({ where: { userId, customerId, reversedAt: null } });
  }
}
