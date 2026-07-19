import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PurchaseRepository } from "../domain/purchase.repository";
import { CardRepository } from "../../cards/domain/card.repository";
import { GeneratedInstallment, generateInstallments, generateRecurringOccurrences } from "../domain/installment-generator";
import { CreatePurchaseDto, PurchaseQueryDto, UpdatePurchaseDto } from "./dto/purchase.dto";
import { NotificationsService } from "../../notifications/notifications.service";

/** How many months of a subscription we keep pre-generated ahead of "today". */
const RECURRING_HORIZON_MONTHS = 6;
/** Safety cap for the initial batch when the user sets a far-future end date. */
const RECURRING_MAX_BATCH = 60;

@Injectable()
export class PurchasesService {
  constructor(
    private readonly purchases: PurchaseRepository,
    private readonly cards: CardRepository,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(userId: string, query: PurchaseQueryDto) {
    await this.extendRecurringPurchases(userId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const { items, total } = await this.purchases.findManyPaginated({
      userId,
      search: query.search,
      cardId: query.cardId,
      categoryId: query.categoryId,
      year: query.year,
      month: query.month,
      minAmount: query.minAmount,
      maxAmount: query.maxAmount,
      kind: query.kind,
      favorite: query.favorite,
      trashed: query.trashed,
      page,
      pageSize,
    });

    return {
      items,
      pagination: { page, pageSize, total, totalPages: Math.max(Math.ceil(total / pageSize), 1) },
    };
  }

  async findOne(userId: string, id: string) {
    const purchase = await this.purchases.findByIdWithInstallments(id);
    if (!purchase) throw new NotFoundException("Compra não encontrada.");
    if (purchase.userId !== userId) throw new ForbiddenException();
    return purchase;
  }

  async create(userId: string, dto: CreatePurchaseDto) {
    const card = await this.cards.findById(dto.cardId);
    if (!card || card.userId !== userId) throw new NotFoundException("Cartão não encontrado.");
    if (!card.active) throw new BadRequestException("Não é possível lançar compras em um cartão inativo.");

    const kind = dto.kind ?? (dto.installmentsCount && dto.installmentsCount > 1 ? "INSTALLMENT" : "CASH");
    const purchaseDate = new Date(dto.purchaseDate);
    const recurrenceEndDate = dto.recurrenceEndDate ? new Date(dto.recurrenceEndDate) : undefined;

    let installments: GeneratedInstallment[];
    let installmentsCount: number;

    if (kind === "RECURRING") {
      const batchCount = recurrenceEndDate ? RECURRING_MAX_BATCH : RECURRING_HORIZON_MONTHS;
      installments = generateRecurringOccurrences({
        nextPaymentDate: purchaseDate,
        monthlyAmount: dto.totalAmount,
        count: batchCount,
      });

      if (recurrenceEndDate) {
        const endKey = recurrenceEndDate.getFullYear() * 12 + (recurrenceEndDate.getMonth() + 1);
        installments = installments.filter((o) => o.referenceYear * 12 + o.referenceMonth <= endKey);
        if (installments.length === 0) {
          throw new BadRequestException("A data de término precisa ser depois da primeira cobrança.");
        }
      }
      installmentsCount = installments.length;
    } else {
      installmentsCount = kind === "CASH" ? 1 : (dto.installmentsCount ?? 1);
      installments = generateInstallments({
        purchaseDate,
        closingDay: card.closingDay,
        dueDay: card.dueDay,
        totalAmount: dto.totalAmount,
        installmentsCount,
        downPayment: dto.downPayment,
      });

      const financedSum = Math.round(installments.reduce((acc, i) => acc + i.amount, 0) * 100) / 100;
      const expectedFinanced = Math.round((dto.totalAmount - (dto.downPayment ?? 0)) * 100) / 100;
      if (financedSum !== expectedFinanced) {
        throw new BadRequestException("Inconsistência no cálculo das parcelas. Operação abortada.");
      }
    }

    const purchase = await this.purchases.createWithInstallments({
      purchase: {
        userId,
        cardId: dto.cardId,
        categoryId: dto.categoryId,
        name: dto.name,
        merchant: dto.merchant,
        notes: dto.notes,
        totalAmount: dto.totalAmount,
        purchaseDate,
        kind,
        installmentsCount,
        downPayment: kind === "RECURRING" ? undefined : dto.downPayment,
        isRecurring: kind === "RECURRING",
        recurrenceEndDate,
        tags: dto.tags ?? [],
        isFavorite: dto.isFavorite ?? false,
        attachmentUrl: dto.attachmentUrl,
        attachmentName: dto.attachmentName,
      },
      installments,
      cardId: dto.cardId,
    });

    await this.notifications.evaluateLimitUsage(userId, dto.cardId);

    return this.purchases.findByIdWithInstallments(purchase.id);
  }

  /**
   * Subscriptions are open-ended, so we don't generate installments forever up front.
   * Instead, every time the user looks at their purchases we top each active subscription
   * back up to a rolling N-month horizon — the same "no cron needed" pattern used for
   * marking overdue installments as late.
   */
  async extendRecurringPurchases(userId: string) {
    const recurring = await this.purchases.findActiveRecurringForExtension(userId);
    if (recurring.length === 0) return;

    const now = new Date();
    const targetKey = now.getFullYear() * 12 + (now.getMonth() + 1) + RECURRING_HORIZON_MONTHS;

    for (const p of recurring) {
      const latestKey = p.latestReferenceYear * 12 + p.latestReferenceMonth;
      if (latestKey >= targetKey) continue;

      let occurrences = generateRecurringOccurrences({
        nextPaymentDate: p.purchaseDate,
        monthlyAmount: p.monthlyAmount,
        startNumber: p.installmentsCount + 1,
        count: targetKey - latestKey,
      });

      if (p.recurrenceEndDate) {
        const endKey = p.recurrenceEndDate.getFullYear() * 12 + (p.recurrenceEndDate.getMonth() + 1);
        occurrences = occurrences.filter((o) => o.referenceYear * 12 + o.referenceMonth <= endKey);
      }
      if (occurrences.length === 0) continue;

      await this.purchases.appendRecurringOccurrences(
        p.id,
        userId,
        p.cardId,
        occurrences,
        p.installmentsCount + occurrences.length,
      );
    }
  }

  async cancelRecurrence(userId: string, id: string) {
    const purchase = await this.getOwned(userId, id);
    if (purchase.kind !== "RECURRING") {
      throw new BadRequestException("Esta compra não é uma assinatura recorrente.");
    }
    if (purchase.recurrenceEndDate && purchase.recurrenceEndDate <= new Date()) {
      throw new BadRequestException("Esta assinatura já foi cancelada.");
    }

    const now = new Date();
    const currentKey = now.getFullYear() * 12 + (now.getMonth() + 1);
    await this.purchases.cancelFutureRecurringOccurrences(id, currentKey, now);

    return this.purchases.findByIdWithInstallments(id);
  }

  async update(userId: string, id: string, dto: UpdatePurchaseDto) {
    await this.getOwned(userId, id);
    await this.purchases.update(id, dto as Record<string, unknown>);
    return this.purchases.findByIdWithInstallments(id);
  }

  async duplicate(userId: string, id: string) {
    const original = await this.purchases.findByIdWithInstallments(id);
    if (!original) throw new NotFoundException("Compra não encontrada.");
    if (original.userId !== userId) throw new ForbiddenException();

    return this.create(userId, {
      name: `${original.name} (cópia)`,
      cardId: original.cardId,
      categoryId: original.categoryId ?? undefined,
      merchant: original.merchant ?? undefined,
      notes: original.notes ?? undefined,
      totalAmount: Number(original.totalAmount),
      purchaseDate: new Date().toISOString(),
      kind: original.kind,
      installmentsCount: original.kind === "RECURRING" ? undefined : original.installmentsCount,
      downPayment: original.downPayment ? Number(original.downPayment) : undefined,
      tags: original.tags,
    });
  }

  async softDelete(userId: string, id: string) {
    await this.getOwned(userId, id);
    await this.purchases.softDelete(id);
    return { id };
  }

  async restore(userId: string, id: string) {
    await this.getOwned(userId, id, true);
    await this.purchases.restore(id);
    return { id };
  }

  async hardDelete(userId: string, id: string) {
    await this.getOwned(userId, id, true);
    await this.purchases.hardDelete(id);
    return { id };
  }

  private async getOwned(userId: string, id: string, allowTrashed = false) {
    const purchase = await this.purchases.findById(id);
    if (!purchase) throw new NotFoundException("Compra não encontrada.");
    if (purchase.userId !== userId) throw new ForbiddenException();
    if (!allowTrashed && purchase.deletedAt) throw new BadRequestException("Compra está na lixeira.");
    return purchase;
  }
}
