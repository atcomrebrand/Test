import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { HouseholdCardRepository } from "../domain/household-card.repository";
import { HouseholdCardEntryRepository, HouseholdCardEntryWithCard } from "../domain/household-card-entry.repository";
import { HouseholdAuditService } from "./household-audit.service";
import {
  CreateHouseholdCardDto,
  UpdateHouseholdCardDto,
  UpdateHouseholdCardEntryDto,
  UpsertHouseholdCardEntryDto,
} from "./dto/household-card.dto";

@Injectable()
export class HouseholdCardsService {
  constructor(
    private readonly cards: HouseholdCardRepository,
    private readonly entries: HouseholdCardEntryRepository,
    private readonly audit: HouseholdAuditService,
  ) {}

  findAll(userId: string) {
    return this.cards.findAllByUser(userId);
  }

  async create(userId: string, dto: CreateHouseholdCardDto) {
    const card = await this.cards.create({ userId, ...dto });
    await this.audit.log(userId, "HouseholdCard", card.id, "CREATE", null, card);
    return card;
  }

  async update(userId: string, id: string, dto: UpdateHouseholdCardDto) {
    const before = await this.getOwnedCard(userId, id);
    const after = await this.cards.update(id, { ...dto });
    await this.audit.log(userId, "HouseholdCard", id, "UPDATE", before, after);
    return after;
  }

  async remove(userId: string, id: string) {
    await this.getOwnedCard(userId, id);
    const count = await this.cards.countEntries(id);
    if (count > 0) {
      throw new BadRequestException("Este cartão já tem faturas lançadas — desative-o em vez de excluir, pra manter o histórico.");
    }
    await this.cards.delete(id);
    return { id };
  }

  async findMonth(userId: string, referenceYear: number, referenceMonth: number) {
    const entries = await this.entries.findByMonth(userId, referenceYear, referenceMonth);
    return entries.map((e) => this.present(e));
  }

  async createEntry(userId: string, cardId: string, referenceYear: number, referenceMonth: number, dto: UpsertHouseholdCardEntryDto) {
    await this.getOwnedCard(userId, cardId);

    try {
      const entry = await this.entries.create({
        userId,
        cardId,
        referenceYear,
        referenceMonth,
        totalInvoice: dto.totalInvoice,
        provisioned: dto.provisioned,
        notes: dto.notes,
      });
      await this.audit.log(userId, "HouseholdCardEntry", entry.id, "CREATE", null, this.snapshotEntry(entry));
      return this.present(entry);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new BadRequestException("Já existe uma fatura lançada pra este cartão nesse mês.");
      }
      throw err;
    }
  }

  async updateEntry(userId: string, id: string, dto: UpdateHouseholdCardEntryDto) {
    const before = await this.getOwnedEntry(userId, id);

    const paid = dto.paid ?? before.paid;
    const paidAt = paid ? (before.paid ? before.paidAt : new Date()) : null;

    const after = await this.entries.update(id, {
      totalInvoice: dto.totalInvoice,
      provisioned: dto.provisioned,
      paid,
      paidAt,
      notes: dto.notes ?? before.notes ?? undefined,
    });
    await this.audit.log(userId, "HouseholdCardEntry", id, "UPDATE", this.snapshotEntry(before), this.snapshotEntry(after));
    return this.present(after);
  }

  /** realAmount is always totalInvoice - provisioned — never stored, so it can never drift. */
  private present(entry: HouseholdCardEntryWithCard) {
    const realAmount = Math.round((Number(entry.totalInvoice) - Number(entry.provisioned)) * 100) / 100;
    return { ...entry, realAmount };
  }

  private snapshotEntry(entry: HouseholdCardEntryWithCard) {
    return { totalInvoice: entry.totalInvoice, provisioned: entry.provisioned, paid: entry.paid };
  }

  private async getOwnedCard(userId: string, id: string) {
    const card = await this.cards.findById(id);
    if (!card) throw new NotFoundException("Cartão não encontrado.");
    if (card.userId !== userId) throw new ForbiddenException();
    return card;
  }

  private async getOwnedEntry(userId: string, id: string) {
    const entry = await this.entries.findById(id);
    if (!entry) throw new NotFoundException("Fatura não encontrada.");
    if (entry.userId !== userId) throw new ForbiddenException();
    return entry;
  }
}
