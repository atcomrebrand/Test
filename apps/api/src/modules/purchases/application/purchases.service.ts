import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PurchaseRepository } from "../domain/purchase.repository";
import { CardRepository } from "../../cards/domain/card.repository";
import { generateInstallments } from "../domain/installment-generator";
import { CreatePurchaseDto, PurchaseQueryDto, UpdatePurchaseDto } from "./dto/purchase.dto";
import { NotificationsService } from "../../notifications/notifications.service";

@Injectable()
export class PurchasesService {
  constructor(
    private readonly purchases: PurchaseRepository,
    private readonly cards: CardRepository,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(userId: string, query: PurchaseQueryDto) {
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
    const installmentsCount = kind === "CASH" ? 1 : (dto.installmentsCount ?? 1);
    const purchaseDate = new Date(dto.purchaseDate);

    const installments = generateInstallments({
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
        downPayment: dto.downPayment,
        isRecurring: dto.isRecurring ?? false,
        recurrenceEndDate: dto.recurrenceEndDate ? new Date(dto.recurrenceEndDate) : undefined,
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
      installmentsCount: original.installmentsCount,
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
