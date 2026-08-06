import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { HouseholdCardRepository } from "../domain/household-card.repository";
import { HouseholdCardEntryRepository, HouseholdCardEntryWithCard } from "../domain/household-card-entry.repository";
import { HouseholdAuditService } from "./household-audit.service";
import { HouseholdMonthCompletionService } from "./household-month-completion.service";
import { InstallmentsService } from "../../installments/installments.service";
import { CardRepository } from "../../cards/domain/card.repository";
import { CreateHouseholdCardDto, UpdateHouseholdCardDto, UpdateHouseholdCardEntryDto } from "./dto/household-card.dto";

@Injectable()
export class HouseholdCardsService {
  constructor(
    private readonly cards: HouseholdCardRepository,
    private readonly entries: HouseholdCardEntryRepository,
    private readonly audit: HouseholdAuditService,
    private readonly monthCompletion: HouseholdMonthCompletionService,
    private readonly installments: InstallmentsService,
    private readonly parcelamentoCards: CardRepository,
  ) {}

  findAll(userId: string) {
    return this.cards.findAllByUser(userId);
  }

  async create(userId: string, dto: CreateHouseholdCardDto) {
    await this.assertLinkable(userId, dto.linkedCardId);
    const card = await this.cards.create({ userId, ...dto });
    await this.audit.log(userId, "HouseholdCard", card.id, "CREATE", null, card);
    return card;
  }

  async update(userId: string, id: string, dto: UpdateHouseholdCardDto) {
    const before = await this.getOwnedCard(userId, id);
    await this.assertLinkable(userId, dto.linkedCardId);
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
    const presumed = await this.presumedTotalsFor(userId, entries, referenceYear, referenceMonth);
    return entries.map((e) => this.present(e, presumed));
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
    const presumed = await this.presumedTotalsFor(userId, [after], after.referenceYear, after.referenceMonth);
    return this.present(after, presumed);
  }

  /** Presumed invoice per entry — the linked Parcelamento card's installment total for this exact
   *  competência (same referenceYear/referenceMonth as the entry, never "the current month"),
   *  computed live and never stored. Only fetched for entries that actually need it (fatura still
   *  at R$0 and the card has a link), batched into one query instead of one per card. */
  private async presumedTotalsFor(
    userId: string,
    entries: HouseholdCardEntryWithCard[],
    referenceYear: number,
    referenceMonth: number,
  ): Promise<Map<string, number>> {
    const linkedCardIds = entries.filter((e) => Number(e.totalInvoice) === 0 && e.card.linkedCardId).map((e) => e.card.linkedCardId as string);
    if (linkedCardIds.length === 0) return new Map();
    return this.installments.getMonthlyTotalsForCards(userId, linkedCardIds, referenceYear, referenceMonth);
  }

  /** realAmount is always totalInvoice - provisioned — never stored, so it can never drift. When
   *  the fatura hasn't been entered yet (totalInvoice still R$0) and the card is linked to a
   *  Parcelamento card, both presumedInvoice (shown in blue by the frontend) and realAmount itself
   *  fall back to that card's installment total for the month — the moment a real value is saved,
   *  this stops applying on its own, since the R$0 gate closes. */
  private present(entry: HouseholdCardEntryWithCard, presumed: Map<string, number>) {
    const totalInvoice = Number(entry.totalInvoice);
    const presumedInvoice = totalInvoice === 0 && entry.card.linkedCardId ? (presumed.get(entry.card.linkedCardId) ?? null) : null;
    const effectiveInvoice = presumedInvoice ?? totalInvoice;
    const realAmount = Math.round((effectiveInvoice - Number(entry.provisioned)) * 100) / 100;
    return { ...entry, realAmount, presumedInvoice };
  }

  private snapshotEntry(entry: HouseholdCardEntryWithCard) {
    return { totalInvoice: entry.totalInvoice, provisioned: entry.provisioned, paid: entry.paid };
  }

/**
   * A linked Parcelamento card has to belong to the same user. Today nothing leaks if it doesn't —
   * getMonthlyTotalsForCards filters by userId as well, so a forged link just yields no presumed
   * invoice — but that leaves the only thing standing between a foreign card id and its invoice
   * total in a query two modules away. Refusing the link here keeps the foreign id out of the
   * database at all, instead of relying on every future reader remembering to scope by user.
   */
  private async assertLinkable(userId: string, linkedCardId: string | null | undefined) {
    if (!linkedCardId) return;
    const card = await this.parcelamentoCards.findById(linkedCardId);
    if (!card || card.userId !== userId) throw new NotFoundException("Cartão do Parcelamento não encontrado.");
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
