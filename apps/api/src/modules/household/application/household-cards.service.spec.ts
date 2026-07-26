import { HouseholdCardsService } from "./household-cards.service";
import { HouseholdCardRepository } from "../domain/household-card.repository";
import { HouseholdCardEntryRepository } from "../domain/household-card-entry.repository";
import { HouseholdAuditService } from "./household-audit.service";
import { HouseholdMonthCompletionService } from "./household-month-completion.service";
import { InstallmentsService } from "../../installments/installments.service";

function makeCards(overrides: Partial<HouseholdCardRepository> = {}): HouseholdCardRepository {
  return {
    findAllByUser: jest.fn(),
    findActiveByUser: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    reorder: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as HouseholdCardRepository;
}

function makeEntries(overrides: Partial<HouseholdCardEntryRepository> = {}): HouseholdCardEntryRepository {
  return {
    findByMonth: jest.fn().mockResolvedValue([]),
    findExistingCardIdsForMonth: jest.fn().mockResolvedValue(new Set()),
    createMany: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn(),
    findByCardAndMonth: jest.fn(),
    update: jest.fn(),
    ...overrides,
  } as unknown as HouseholdCardEntryRepository;
}

function makeAudit(): HouseholdAuditService {
  return { log: jest.fn().mockResolvedValue(undefined) } as unknown as HouseholdAuditService;
}

function makeMonthCompletion(): HouseholdMonthCompletionService {
  return { checkAndNotify: jest.fn().mockResolvedValue(undefined) } as unknown as HouseholdMonthCompletionService;
}

function makeInstallments(): InstallmentsService {
  return { getMonthlyTotalsForCards: jest.fn().mockResolvedValue(new Map()) } as unknown as InstallmentsService;
}

describe("HouseholdCardsService.findMonth — auto-generation", () => {
  it("creates a zeroed competência for every active card missing one this month", async () => {
    const cards = makeCards({ findActiveByUser: jest.fn().mockResolvedValue([{ id: "card-1" }, { id: "card-2" }]) });
    const createMany = jest.fn().mockResolvedValue(undefined);
    const entries = makeEntries({ findExistingCardIdsForMonth: jest.fn().mockResolvedValue(new Set(["card-1"])), createMany });
    const service = new HouseholdCardsService(cards, entries, makeAudit(), makeMonthCompletion(), makeInstallments());

    await service.findMonth("user-1", 2026, 7);

    expect(createMany).toHaveBeenCalledWith([{ userId: "user-1", cardId: "card-2", referenceYear: 2026, referenceMonth: 7, totalInvoice: 0, provisioned: 0 }]);
  });

  it("does not create anything when every active card already has a competência this month", async () => {
    const cards = makeCards({ findActiveByUser: jest.fn().mockResolvedValue([{ id: "card-1" }]) });
    const createMany = jest.fn().mockResolvedValue(undefined);
    const entries = makeEntries({ findExistingCardIdsForMonth: jest.fn().mockResolvedValue(new Set(["card-1"])), createMany });
    const service = new HouseholdCardsService(cards, entries, makeAudit(), makeMonthCompletion(), makeInstallments());

    await service.findMonth("user-1", 2026, 7);

    expect(createMany).not.toHaveBeenCalled();
  });

  it("does nothing when the user has no active cards", async () => {
    const cards = makeCards({ findActiveByUser: jest.fn().mockResolvedValue([]) });
    const findExistingCardIdsForMonth = jest.fn();
    const entries = makeEntries({ findExistingCardIdsForMonth });
    const service = new HouseholdCardsService(cards, entries, makeAudit(), makeMonthCompletion(), makeInstallments());

    await service.findMonth("user-1", 2026, 7);

    expect(findExistingCardIdsForMonth).not.toHaveBeenCalled();
  });

  it("returns the month's entries, presented with realAmount, after generating", async () => {
    const cards = makeCards({ findActiveByUser: jest.fn().mockResolvedValue([{ id: "card-1" }]) });
    const entries = makeEntries({
      findExistingCardIdsForMonth: jest.fn().mockResolvedValue(new Set(["card-1"])),
      findByMonth: jest.fn().mockResolvedValue([{ id: "e1", cardId: "card-1", totalInvoice: "500", provisioned: "100", paid: false }]),
    });
    const service = new HouseholdCardsService(cards, entries, makeAudit(), makeMonthCompletion(), makeInstallments());

    const result = await service.findMonth("user-1", 2026, 7);

    expect(result).toEqual([expect.objectContaining({ id: "e1", realAmount: 400 })]);
  });
});

describe("HouseholdCardsService.findMonth — fatura presumida", () => {
  it("uses the linked Parcelamento card's installment total when totalInvoice is still R$0", async () => {
    const cards = makeCards({ findActiveByUser: jest.fn().mockResolvedValue([{ id: "card-1" }]) });
    const getMonthlyTotalsForCards = jest.fn().mockResolvedValue(new Map([["linked-1", 450]]));
    const installments = makeInstallments();
    (installments.getMonthlyTotalsForCards as jest.Mock) = getMonthlyTotalsForCards;
    const entries = makeEntries({
      findExistingCardIdsForMonth: jest.fn().mockResolvedValue(new Set(["card-1"])),
      findByMonth: jest
        .fn()
        .mockResolvedValue([
          { id: "e1", cardId: "card-1", totalInvoice: "0", provisioned: "50", paid: false, card: { id: "card-1", linkedCardId: "linked-1" } },
        ]),
    });
    const service = new HouseholdCardsService(cards, entries, makeAudit(), makeMonthCompletion(), installments);

    const result = await service.findMonth("user-1", 2026, 7);

    expect(getMonthlyTotalsForCards).toHaveBeenCalledWith("user-1", ["linked-1"], 2026, 7);
    expect(result).toEqual([expect.objectContaining({ presumedInvoice: 450, realAmount: 400 })]);
  });

  it("never touches presumedInvoice once a real (nonzero) totalInvoice is saved", async () => {
    const cards = makeCards({ findActiveByUser: jest.fn().mockResolvedValue([{ id: "card-1" }]) });
    const getMonthlyTotalsForCards = jest.fn().mockResolvedValue(new Map([["linked-1", 450]]));
    const installments = makeInstallments();
    (installments.getMonthlyTotalsForCards as jest.Mock) = getMonthlyTotalsForCards;
    const entries = makeEntries({
      findExistingCardIdsForMonth: jest.fn().mockResolvedValue(new Set(["card-1"])),
      findByMonth: jest
        .fn()
        .mockResolvedValue([
          { id: "e1", cardId: "card-1", totalInvoice: "300", provisioned: "0", paid: false, card: { id: "card-1", linkedCardId: "linked-1" } },
        ]),
    });
    const service = new HouseholdCardsService(cards, entries, makeAudit(), makeMonthCompletion(), installments);

    const result = await service.findMonth("user-1", 2026, 7);

    expect(getMonthlyTotalsForCards).not.toHaveBeenCalled();
    expect(result).toEqual([expect.objectContaining({ presumedInvoice: null, realAmount: 300 })]);
  });

  it("leaves presumedInvoice null for a card with no link, even at R$0", async () => {
    const cards = makeCards({ findActiveByUser: jest.fn().mockResolvedValue([{ id: "card-1" }]) });
    const getMonthlyTotalsForCards = jest.fn();
    const installments = makeInstallments();
    (installments.getMonthlyTotalsForCards as jest.Mock) = getMonthlyTotalsForCards;
    const entries = makeEntries({
      findExistingCardIdsForMonth: jest.fn().mockResolvedValue(new Set(["card-1"])),
      findByMonth: jest
        .fn()
        .mockResolvedValue([{ id: "e1", cardId: "card-1", totalInvoice: "0", provisioned: "0", paid: false, card: { id: "card-1", linkedCardId: null } }]),
    });
    const service = new HouseholdCardsService(cards, entries, makeAudit(), makeMonthCompletion(), installments);

    const result = await service.findMonth("user-1", 2026, 7);

    expect(getMonthlyTotalsForCards).not.toHaveBeenCalled();
    expect(result).toEqual([expect.objectContaining({ presumedInvoice: null, realAmount: 0 })]);
  });

  it("batches every card needing a presumed value into a single call", async () => {
    const cards = makeCards({ findActiveByUser: jest.fn().mockResolvedValue([{ id: "card-1" }, { id: "card-2" }]) });
    const getMonthlyTotalsForCards = jest.fn().mockResolvedValue(
      new Map([
        ["linked-1", 100],
        ["linked-2", 200],
      ]),
    );
    const installments = makeInstallments();
    (installments.getMonthlyTotalsForCards as jest.Mock) = getMonthlyTotalsForCards;
    const entries = makeEntries({
      findExistingCardIdsForMonth: jest.fn().mockResolvedValue(new Set(["card-1", "card-2"])),
      findByMonth: jest.fn().mockResolvedValue([
        { id: "e1", cardId: "card-1", totalInvoice: "0", provisioned: "0", paid: false, card: { id: "card-1", linkedCardId: "linked-1" } },
        { id: "e2", cardId: "card-2", totalInvoice: "0", provisioned: "0", paid: false, card: { id: "card-2", linkedCardId: "linked-2" } },
      ]),
    });
    const service = new HouseholdCardsService(cards, entries, makeAudit(), makeMonthCompletion(), installments);

    await service.findMonth("user-1", 2026, 7);

    expect(getMonthlyTotalsForCards).toHaveBeenCalledTimes(1);
    expect(getMonthlyTotalsForCards).toHaveBeenCalledWith("user-1", ["linked-1", "linked-2"], 2026, 7);
  });
});

describe("HouseholdCardsService.remove", () => {
  it("deletes the card unconditionally, without checking for existing entries first", async () => {
    const card = { id: "card-1", userId: "user-1", name: "Nubank" };
    const deleteFn = jest.fn().mockResolvedValue(undefined);
    const cards = makeCards({ findById: jest.fn().mockResolvedValue(card), delete: deleteFn });
    const entries = makeEntries();
    const audit = makeAudit();
    const service = new HouseholdCardsService(cards, entries, audit, makeMonthCompletion(), makeInstallments());

    const result = await service.remove("user-1", "card-1");

    expect(deleteFn).toHaveBeenCalledWith("card-1");
    expect(audit.log).toHaveBeenCalledWith("user-1", "HouseholdCard", "card-1", "DELETE", card, null);
    expect(result).toEqual({ id: "card-1" });
  });
});

describe("HouseholdCardsService.reorder", () => {
  it("persists the new order and returns the freshly ordered list", async () => {
    const reorderFn = jest.fn().mockResolvedValue(undefined);
    const reordered = [{ id: "card-2" }, { id: "card-1" }];
    const cards = makeCards({ reorder: reorderFn, findAllByUser: jest.fn().mockResolvedValue(reordered) });
    const entries = makeEntries();
    const service = new HouseholdCardsService(cards, entries, makeAudit(), makeMonthCompletion(), makeInstallments());

    const result = await service.reorder("user-1", ["card-2", "card-1"]);

    expect(reorderFn).toHaveBeenCalledWith("user-1", ["card-2", "card-1"]);
    expect(result).toEqual(reordered);
  });
});
