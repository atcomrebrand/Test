import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { HouseholdCardRepository } from "../domain/household-card.repository";
import { HouseholdCardEntryRepository, HouseholdCardEntryWithCard } from "../domain/household-card-entry.repository";
import { HouseholdAuditService } from "./household-audit.service";
import { HouseholdMonthCompletionService } from "./household-month-completion.service";
import { CreateHouseholdCardDto, UpdateHouseholdCardDto, UpdateHouseholdCardEntryDto } from "./dto/household-card.dto";

@Injectable()
export class HouseholdCardsService {
  constructor(
    private readonly cards: HouseholdCardRepository,
    private readonly entries: HouseholdCardEntryRepository,
    private readonly audit: HouseholdAuditService,
    private readonly monthCompletion: HouseholdMonthCompletionService,
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

  /** Always deletes, cascading every fatura já lançada (HouseholdCardEntry has onDelete: Cascade)
   *  — the choice between keeping history (desativar) and erasing it (excluir) belongs to the
   *  user, made explicit in the frontend's confirmation dialog before this is ever called. */
  async remove(userId: string, id: string) {
    const before = await this.getOwnedCard(userId, id);
    await this.cards.delete(id);
    await this.audit.log(userId, "HouseholdCard", id, "DELETE", before, null);
    return { id };
  }

  async reorder(userId: string, ids: string[]) {
    await this.cards.reorder(userId, ids);
    return this.cards.findAllByUser(userId);
  }

  /** Same pattern as HouseholdBillsService.findMonth — generates any missing competência (fatura
   *  zerada) for active cards on demand, so a card shows up in Contas the moment it's created,
   *  every month, without a separate "lançar fatura" step. */
  async findMonth(userId: string, referenceYear: number, referenceMonth: number) {
    await this.ensureMonthGenerated(userId, referenceYear, referenceMonth);
    const entries = await this.entries.findByMonth(userId, referenceYear, referenceMonth);
    return entries.map((e) => this.present(e));
  }

  async ensureMonthGenerated(userId: string, referenceYear: number, referenceMonth: number) {
    const activeCards = await this.cards.findActiveByUser(userId);
    if (activeCards.length === 0) return;

    const existingCardIds = await this.entries.findExistingCardIdsForMonth(userId, referenceYear, referenceMonth);
    const missing = activeCards.filter((c) => !existingCardIds.has(c.id));
    if (missing.length === 0) return;

    const toCreate = missing.map((card) => ({ userId, cardId: card.id, referenceYear, referenceMonth, totalInvoice: 0, provisioned: 0 }));
    await this.entries.createMany(toCreate);
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
    await this.monthCompletion.checkAndNotify(userId, after.referenceYear, after.referenceMonth);
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
