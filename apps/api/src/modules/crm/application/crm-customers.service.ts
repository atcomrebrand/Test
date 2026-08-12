import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { CrmCustomerRepository, CustomerFilters, CustomerWithRelations } from "../domain/crm-customer.repository";
import { computeCustomerStatus, CrmCustomerStatus } from "../domain/customer-status";
import { classifyVip, splitPaymentFee } from "../domain/revenue";
import { computeNextDueDate, computeTenure, monthsInPeriod } from "../domain/tenure";
import { CrmAuditService } from "./crm-audit.service";
import { CrmCatalogService } from "./crm-catalog.service";
import {
  CancelCustomerDto,
  CreateCrmCustomerDto,
  CreateCrmPaymentDto,
  CreateCrmSubscriptionDto,
  RenewSubscriptionDto,
  UpdateCrmCustomerDto,
  UpdateCrmSubscriptionDto,
} from "./dto/crm-customer.dto";

/** Meia-noite UTC de hoje — mesma convenção do repositório, pra janela e status concordarem. */
function today(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class CrmCustomersService {
  constructor(
    private readonly repo: CrmCustomerRepository,
    private readonly catalog: CrmCatalogService,
    private readonly audit: CrmAuditService,
  ) {}

  /**
   * Anexa o que é derivado — status, dias até vencer, tempo de casa. Fica no `present` e não no
   * banco porque envelhece: o mesmo registro lido amanhã responde outra coisa.
   */
  present(customer: CustomerWithRelations, now = today()) {
    const status = computeCustomerStatus({
      currentDueDate: customer.currentDueDate,
      manualStatus: (customer.manualStatus as CrmCustomerStatus | null) ?? null,
      trialEndsAt: customer.trialEndsAt,
      hasEverSubscribed: customer.subscriptions.length > 0,
      today: now,
    });

    return {
      ...customer,
      tags: customer.tags.map((t) => t.tag),
      ...status,
      tenure: computeTenure(customer.firstSubscribedAt, now),
      activeSubscription: customer.subscriptions.find((s) => s.status === "ACTIVE") ?? null,
    };
  }

  async list(userId: string, filters: CustomerFilters) {
    if (filters.portfolioId) await this.catalog.assertPortfolio(userId, filters.portfolioId);
    const rows = await this.repo.list(userId, filters);
    const now = today();
    return rows.map((c) => this.present(c, now));
  }

  async assertOwned(userId: string, id: string) {
    const found = await this.repo.findById(userId, id);
    if (!found) throw new NotFoundException("Cliente não encontrado");
    return found;
  }

  /** Perfil completo: receita por janela, pagamentos, assinaturas, timeline e VIP calculado. */
  async detail(userId: string, id: string) {
    const customer = await this.assertOwned(userId, id);
    const now = today();

    const [revenue, payments, events, renewals, settings] = await Promise.all([
      this.repo.computeRevenue(userId, id, now),
      this.repo.listPayments(userId, id),
      this.repo.listEvents(userId, id),
      this.repo.countRenewals(userId, id),
      this.catalog.getSettings(userId),
    ]);

    const presented = this.present(customer, now);
    const vip = classifyVip(
      {
        monthsAsCustomer: presented.tenure?.months ?? 0,
        totalRevenue: revenue.total,
        renewals,
        vipManual: customer.vipManual,
      },
      {
        minMonths: settings.vipMinMonths,
        minRevenue: settings.vipMinRevenue ? Number(settings.vipMinRevenue) : null,
        minRenewals: settings.vipMinRenewals,
      },
    );

    return {
      ...presented,
      vip,
      revenue,
      // Ticket médio do cliente: o que ele costuma pagar, não o que o negócio costuma receber.
      averageTicket: revenue.count > 0 ? Math.round((revenue.total / revenue.count) * 100) / 100 : null,
      renewals,
      payments,
      events,
      subscriptions: customer.subscriptions,
    };
  }

  async create(userId: string, dto: CreateCrmCustomerDto) {
    await this.catalog.assertPortfolio(userId, dto.portfolioId);
    if (dto.originId) await this.catalog.assertOrigin(userId, dto.originId);
    if (dto.tagIds?.length) await this.catalog.assertTags(userId, dto.tagIds);
    if (dto.referredById) await this.assertOwned(userId, dto.referredById);

    const created = await this.repo.create(userId, {
      ...dto,
      trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : null,
    });

    await this.repo.addEvent(userId, created.id, "CREATED", "Cliente cadastrado");
    await this.audit.log(userId, "CrmCustomer", created.id, "CREATE", null, created);
    return this.present(created);
  }

  async update(userId: string, id: string, dto: UpdateCrmCustomerDto) {
    const before = await this.assertOwned(userId, id);
    if (dto.portfolioId) await this.catalog.assertPortfolio(userId, dto.portfolioId);
    if (dto.originId) await this.catalog.assertOrigin(userId, dto.originId);
    if (dto.tagIds?.length) await this.catalog.assertTags(userId, dto.tagIds);
    if (dto.referredById) await this.assertOwned(userId, dto.referredById);

    const { tagIds, ...rest } = dto;
    const data: Record<string, unknown> = { ...rest };
    if (dto.trialEndsAt !== undefined) data.trialEndsAt = dto.trialEndsAt ? new Date(dto.trialEndsAt) : null;

    const after = await this.repo.update(id, data, tagIds);

    // Mudança de portfólio é registrada explicitamente (§46): o histórico financeiro fica onde
    // está, mas quem olhar a timeline depois precisa saber que o serviço mudou.
    if (dto.portfolioId && dto.portfolioId !== before.portfolioId) {
      await this.repo.addEvent(userId, id, "PORTFOLIO_CHANGED", "Cliente movido de serviço");
    }
    await this.audit.log(userId, "CrmCustomer", id, "UPDATE", before, after);
    return this.present(after);
  }

  async remove(userId: string, id: string) {
    const before = await this.assertOwned(userId, id);
    await this.repo.softDelete(id);
    await this.audit.log(userId, "CrmCustomer", id, "DELETE", before, null);
    return { id };
  }

  async cancel(userId: string, id: string, dto: CancelCustomerDto) {
    const before = await this.assertOwned(userId, id);
    const after = await this.repo.update(id, { manualStatus: "CANCELLED" });

    const active = await this.repo.findActiveSubscription(userId, id);
    if (active) {
      await this.repo.updateSubscription(active.id, { status: "CANCELLED", cancelledAt: new Date() });
    }

    await this.repo.addEvent(userId, id, "CANCELLED", dto.reason ? `Cancelado: ${dto.reason}` : "Cliente cancelado");
    await this.audit.log(userId, "CrmCustomer", id, "CANCEL", before, after);
    return this.present(after);
  }

  /** Tira o override manual e devolve o cliente pro cálculo normal. */
  async reactivate(userId: string, id: string) {
    await this.assertOwned(userId, id);
    const after = await this.repo.update(id, { manualStatus: null });
    await this.repo.addEvent(userId, id, "REACTIVATED", "Cliente reativado");
    return this.present(after);
  }

  // -------------------------------------------------------------------------
  // Assinaturas
  // -------------------------------------------------------------------------

  async createSubscription(userId: string, dto: CreateCrmSubscriptionDto) {
    const customer = await this.assertOwned(userId, dto.customerId);
    if (dto.planId) await this.catalog.assertPlan(userId, dto.planId);
    if (dto.paymentMethodId) await this.catalog.assertPaymentMethod(userId, dto.paymentMethodId);

    const dueDate = new Date(dto.dueDate);
    const startDate = new Date(dto.startDate);

    const subscription = await this.repo.createSubscription(userId, {
      customerId: dto.customerId,
      portfolioId: customer.portfolioId,
      planId: dto.planId ?? null,
      startDate,
      dueDate,
      amount: dto.amount,
      billingPeriod: dto.billingPeriod ?? "MONTHLY",
      customDays: dto.customDays ?? null,
      paymentMethodId: dto.paymentMethodId ?? null,
      notes: dto.notes ?? null,
    });

    await this.repo.update(customer.id, {
      currentDueDate: dueDate,
      // Só grava na primeira: é o marco de "cliente desde", e uma assinatura nova depois de anos
      // não pode zerar o tempo de casa.
      ...(customer.firstSubscribedAt ? {} : { firstSubscribedAt: startDate }),
    });

    await this.repo.addEvent(userId, customer.id, "SUBSCRIPTION_CREATED", "Assinatura criada", dto.amount);
    return subscription;
  }

  async updateSubscription(userId: string, id: string, dto: UpdateCrmSubscriptionDto) {
    const before = await this.repo.findSubscription(userId, id);
    if (!before) throw new NotFoundException("Assinatura não encontrada");
    if (dto.planId) await this.catalog.assertPlan(userId, dto.planId);
    if (dto.paymentMethodId) await this.catalog.assertPaymentMethod(userId, dto.paymentMethodId);

    const data: Record<string, unknown> = { ...dto };
    if (dto.dueDate) data.dueDate = new Date(dto.dueDate);

    const after = await this.repo.updateSubscription(id, data);

    // O vencimento do cliente é a cópia do vencimento da assinatura ativa; editar uma sem a outra
    // faria o painel de vencimentos discordar da tela do cliente.
    if (dto.dueDate && before.status === "ACTIVE") {
      await this.repo.update(before.customerId, { currentDueDate: new Date(dto.dueDate) });
    }
    return after;
  }

  /**
   * Renovação em um clique (§15). Tudo que não vier no corpo sai da assinatura, e o novo vencimento
   * é calculado pelo domínio a partir do vencimento atual.
   */
  async renew(userId: string, subscriptionId: string, dto: RenewSubscriptionDto) {
    const subscription = await this.repo.findSubscription(userId, subscriptionId);
    if (!subscription) throw new NotFoundException("Assinatura não encontrada");

    const customer = await this.assertOwned(userId, subscription.customerId);

    const paymentMethodId = dto.paymentMethodId ?? subscription.paymentMethodId;
    const method = paymentMethodId ? await this.catalog.assertPaymentMethod(userId, paymentMethodId) : null;

    const amount = dto.amount ?? Number(subscription.amount);
    const period = dto.billingPeriod ?? (subscription.billingPeriod as never);
    const customDays = dto.customDays ?? subscription.customDays;
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    const now = today();

    const nextDueDate = computeNextDueDate({
      currentDueDate: subscription.dueDate,
      period,
      customDays,
      today: now,
    });

    // A taxa é copiada agora e congela na linha: mexer na forma de pagamento depois não pode
    // reescrever o líquido desta renovação.
    const fee = splitPaymentFee(amount, {
      feePercent: method ? Number(method.feePercent) : 0,
      feeFixed: method ? Number(method.feeFixed) : 0,
    });

    const { subscription: updated, payment } = await this.repo.renew({
      userId,
      subscriptionId,
      customerId: customer.id,
      portfolioId: subscription.portfolioId,
      amount,
      nextDueDate,
      paidAt,
      paymentMethodId: paymentMethodId ?? null,
      paymentMethodName: method?.name ?? null,
      feePercent: method ? Number(method.feePercent) : 0,
      feeFixed: method ? Number(method.feeFixed) : 0,
      feeAmount: fee.feeAmount,
      netAmount: fee.netAmount,
      periodStart: subscription.dueDate,
      periodEnd: nextDueDate,
      notes: dto.notes ?? null,
      firstSubscribedAt: customer.firstSubscribedAt ?? subscription.startDate,
    });

    await this.audit.log(userId, "CrmSubscription", subscriptionId, "RENEW", subscription, updated);
    return { subscription: updated, payment, nextDueDate, monthsAdvanced: monthsInPeriod(period) };
  }

  // -------------------------------------------------------------------------
  // Pagamentos avulsos
  // -------------------------------------------------------------------------

  async createPayment(userId: string, dto: CreateCrmPaymentDto) {
    const customer = await this.assertOwned(userId, dto.customerId);
    const method = dto.paymentMethodId ? await this.catalog.assertPaymentMethod(userId, dto.paymentMethodId) : null;

    if (dto.subscriptionId) {
      const sub = await this.repo.findSubscription(userId, dto.subscriptionId);
      if (!sub) throw new NotFoundException("Assinatura não encontrada");
      if (sub.customerId !== customer.id) throw new BadRequestException("Assinatura é de outro cliente");
    }

    const fee = splitPaymentFee(dto.grossAmount, {
      feePercent: method ? Number(method.feePercent) : 0,
      feeFixed: method ? Number(method.feeFixed) : 0,
    });

    const payment = await this.repo.createPayment(userId, {
      customerId: customer.id,
      subscriptionId: dto.subscriptionId ?? null,
      portfolioId: customer.portfolioId,
      paidAt: new Date(dto.paidAt),
      grossAmount: dto.grossAmount,
      feePercent: method ? Number(method.feePercent) : 0,
      feeFixed: method ? Number(method.feeFixed) : 0,
      feeAmount: fee.feeAmount,
      netAmount: fee.netAmount,
      paymentMethodId: dto.paymentMethodId ?? null,
      paymentMethodName: method?.name ?? null,
      periodStart: dto.periodStart ? new Date(dto.periodStart) : null,
      periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
      notes: dto.notes ?? null,
    });

    await this.repo.addEvent(userId, customer.id, "PAYMENT", "Pagamento recebido", dto.grossAmount);
    return payment;
  }

  /**
   * Estorno marca a linha e some das somas de receita, mas continua no extrato do cliente. Apagar
   * faria o total do mês mudar sem deixar rastro de por quê.
   */
  async reversePayment(userId: string, id: string) {
    const payment = await this.repo.findPayment(userId, id);
    if (!payment) throw new NotFoundException("Pagamento não encontrado");
    if (payment.reversedAt) throw new BadRequestException("Pagamento já estornado");

    const after = await this.repo.reversePayment(id);
    await this.repo.addEvent(
      userId,
      payment.customerId,
      "PAYMENT_REVERSED",
      "Pagamento estornado",
      Number(payment.grossAmount),
    );
    await this.audit.log(userId, "CrmPayment", id, "REVERSE", payment, after);
    return after;
  }

  listEvents(userId: string, customerId: string) {
    return this.repo.listEvents(userId, customerId);
  }
}
