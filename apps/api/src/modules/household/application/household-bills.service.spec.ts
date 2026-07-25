import { HouseholdBillsService } from "./household-bills.service";
import { HouseholdBillRepository } from "../domain/household-bill.repository";
import { HouseholdBillEntryRepository } from "../domain/household-bill-entry.repository";
import { HouseholdAuditService } from "./household-audit.service";
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
    const service = new HouseholdBillsService(bills, entries, makeAudit(), makeMonthCompletion());

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
    const service = new HouseholdBillsService(bills, entries, makeAudit(), makeMonthCompletion());

    await service.updateEntry("user-1", "entry-1", { paidAmount: 50 });

    expect(updateFn).toHaveBeenCalledWith("entry-1", expect.objectContaining({ skipped: false, paidAmount: 50, status: "PENDING" }));
  });

  it("keeps skipped true when an unrelated field (like notes) is updated without a payment action", async () => {
    const before = makeEntry({ skipped: true, status: "SKIPPED" });
    const updateFn = jest.fn().mockImplementation((_id, data) => ({ ...before, ...data }));
    const bills = makeBills();
    const entries = makeEntries({ findById: jest.fn().mockResolvedValue(before), update: updateFn });
    const service = new HouseholdBillsService(bills, entries, makeAudit(), makeMonthCompletion());

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
    const service = new HouseholdBillsService(bills, entries, audit, makeMonthCompletion());

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
    const service = new HouseholdBillsService(bills, entries, makeAudit(), makeMonthCompletion());

    const result = await service.reorder("user-1", ["bill-2", "bill-1"]);

    expect(reorderFn).toHaveBeenCalledWith("user-1", ["bill-2", "bill-1"]);
    expect(result).toEqual(reordered);
  });
});
