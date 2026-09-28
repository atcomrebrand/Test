import { ForbiddenException } from "@nestjs/common";
import { HouseholdBillsService } from "./household-bills.service";
import { HouseholdBillRepository } from "../domain/household-bill.repository";
import { HouseholdBillEntryRepository } from "../domain/household-bill-entry.repository";
import { HouseholdAuditService } from "./household-audit.service";
import { HouseholdBillCategoriesService } from "./household-bill-categories.service";
import { HouseholdMonthCompletionService } from "./household-month-completion.service";

function makeBills(overrides: Partial<HouseholdBillRepository> = {}): HouseholdBillRepository {
  return {
    findAllByUser: jest.fn(),
    findActiveByUser: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    reorder: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as HouseholdBillRepository;
}

function makeEntries(overrides: Partial<HouseholdBillEntryRepository> = {}): HouseholdBillEntryRepository {
  return {
    findByMonth: jest.fn().mockResolvedValue([]),
    findExistingBillIdsForMonth: jest.fn().mockResolvedValue(new Set()),
    createMany: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn(),
    update: jest.fn(),
    countByBill: jest.fn(),
    ...overrides,
  } as unknown as HouseholdBillEntryRepository;
}

function makeAudit(): HouseholdAuditService {
  return { log: jest.fn().mockResolvedValue(undefined) } as unknown as HouseholdAuditService;
}

function makeMonthCompletion(): HouseholdMonthCompletionService {
  return { checkAndNotify: jest.fn().mockResolvedValue(undefined) } as unknown as HouseholdMonthCompletionService;
}

/** Category ownership guard. Defaults to allowing, so the existing tests keep testing what they
 *  were written to test; the IDOR tests override it to reject. */
function makeBillCategories(overrides: Partial<HouseholdBillCategoriesService> = {}): HouseholdBillCategoriesService {
  return { assertOwned: jest.fn().mockResolvedValue(undefined), ...overrides } as unknown as HouseholdBillCategoriesService;
}

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    userId: "user-1",
    billId: "bill-1",
    bill: { id: "bill-1", allowAmountChange: true },
    amount: 180,
    reservedAmount: 0,
    paidAmount: 0,
    status: "PENDING",
    skipped: false,
    paidAt: null,
    notes: null,
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ...overrides,
  };
}

describe("HouseholdBillsService.updateEntry — skipped", () => {
  it("marks the entry SKIPPED and zeroes reserved/paid amounts", async () => {
    const before = makeEntry();
    const updateFn = jest.fn().mockImplementation((_id, data) => ({ ...before, ...data }));
    const bills = makeBills();
    const entries = makeEntries({ findById: jest.fn().mockResolvedValue(before), update: updateFn });
    const service = new HouseholdBillsService(bills, entries, makeAudit(), makeMonthCompletion(), makeBillCategories());

    await service.updateEntry("user-1", "entry-1", { skipped: true });

    expect(updateFn).toHaveBeenCalledWith(
      "entry-1",
      expect.objectContaining({ skipped: true, status: "SKIPPED", reservedAmount: 0, paidAmount: 0 }),
    );
  });

  it("un-skips automatically when a payment action is taken on an already-skipped entry", async () => {
    const before = makeEntry({ skipped: true, status: "SKIPPED" });
    const updateFn = jest.fn().mockImplementation((_id, data) => ({ ...before, ...data }));
    const bills = makeBills();
    const entries = makeEntries({ findById: jest.fn().mockResolvedValue(before), update: updateFn });
    const service = new HouseholdBillsService(bills, entries, makeAudit(), makeMonthCompletion(), makeBillCategories());

    await service.updateEntry("user-1", "entry-1", { paidAmount: 50 });

    expect(updateFn).toHaveBeenCalledWith("entry-1", expect.objectContaining({ skipped: false, paidAmount: 50, status: "PENDING" }));
  });

  it("keeps skipped true when an unrelated field (like notes) is updated without a payment action", async () => {
    const before = makeEntry({ skipped: true, status: "SKIPPED" });
    const updateFn = jest.fn().mockImplementation((_id, data) => ({ ...before, ...data }));
    const bills = makeBills();
    const entries = makeEntries({ findById: jest.fn().mockResolvedValue(before), update: updateFn });
    const service = new HouseholdBillsService(bills, entries, makeAudit(), makeMonthCompletion(), makeBillCategories());

    await service.updateEntry("user-1", "entry-1", { notes: "sem fatura esse mês" });

    expect(updateFn).toHaveBeenCalledWith("entry-1", expect.objectContaining({ skipped: true, status: "SKIPPED" }));
  });
});

describe("HouseholdBillsService.remove", () => {
  it("deletes the bill unconditionally, without checking for existing competências first", async () => {
    const bill = { id: "bill-1", userId: "user-1", name: "Energia" };
    const deleteFn = jest.fn().mockResolvedValue(undefined);
    const bills = makeBills({ findById: jest.fn().mockResolvedValue(bill), delete: deleteFn });
    const entries = makeEntries();
    const audit = makeAudit();
    const service = new HouseholdBillsService(bills, entries, audit, makeMonthCompletion(), makeBillCategories());

    const result = await service.remove("user-1", "bill-1");

    expect(deleteFn).toHaveBeenCalledWith("bill-1");
    expect(audit.log).toHaveBeenCalledWith("user-1", "HouseholdBill", "bill-1", "DELETE", bill, null);
    expect(result).toEqual({ id: "bill-1" });
  });
});

describe("HouseholdBillsService.reorder", () => {
  it("persists the new order and returns the freshly ordered list", async () => {
    const reorderFn = jest.fn().mockResolvedValue(undefined);
    const reordered = [{ id: "bill-2" }, { id: "bill-1" }];
    const bills = makeBills({ reorder: reorderFn, findAllByUser: jest.fn().mockResolvedValue(reordered) });
    const entries = makeEntries();
    const service = new HouseholdBillsService(bills, entries, makeAudit(), makeMonthCompletion(), makeBillCategories());

    const result = await service.reorder("user-1", ["bill-2", "bill-1"]);

    expect(reorderFn).toHaveBeenCalledWith("user-1", ["bill-2", "bill-1"]);
    expect(result).toEqual(reordered);
  });
});

describe("HouseholdBillsService — dono da categoria (IDOR)", () => {
  // A categoria volta embutida em toda resposta deste módulo, então aceitar um categoryId sem
  // conferir o dono entrega a categoria alheia (nome, cor) a quem apontar pra ela.
  it("recusa criar uma conta apontando pra categoria de outro usuário", async () => {
    const create = jest.fn();
    const categories = makeBillCategories({
      assertOwned: jest.fn().mockRejectedValue(new ForbiddenException()),
    });
    const service = new HouseholdBillsService(makeBills({ create }), makeEntries(), makeAudit(), makeMonthCompletion(), categories);

    await expect(
      service.create("user-1", { name: "Luz", dueDay: 5, defaultAmount: 100, categoryId: "cat-de-outro" } as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(categories.assertOwned).toHaveBeenCalledWith("user-1", "cat-de-outro");
    expect(create).not.toHaveBeenCalled();
  });

  it("recusa mover uma conta própria pra categoria de outro usuário", async () => {
    const update = jest.fn();
    const bills = makeBills({ findById: jest.fn().mockResolvedValue({ id: "bill-1", userId: "user-1" }), update });
    const categories = makeBillCategories({
      assertOwned: jest.fn().mockRejectedValue(new ForbiddenException()),
    });
    const service = new HouseholdBillsService(bills, makeEntries(), makeAudit(), makeMonthCompletion(), categories);

    // Ser dono da conta não diz nada sobre ser dono do que ela está sendo reapontada.
    await expect(service.update("user-1", "bill-1", { categoryId: "cat-de-outro" } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it("deixa passar quando não há categoria nenhuma no payload", async () => {
    const create = jest.fn().mockResolvedValue({ id: "bill-1" });
    const categories = makeBillCategories();
    const service = new HouseholdBillsService(makeBills({ create }), makeEntries(), makeAudit(), makeMonthCompletion(), categories);

    await service.create("user-1", { name: "Luz", dueDay: 5, defaultAmount: 100 } as never);

    expect(categories.assertOwned).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalled();
  });
});
