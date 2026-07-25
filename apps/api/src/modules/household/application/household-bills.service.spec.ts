import { HouseholdBillsService } from "./household-bills.service";
import { HouseholdBillRepository } from "../domain/household-bill.repository";
import { HouseholdBillEntryRepository } from "../domain/household-bill-entry.repository";
import { HouseholdAuditService } from "./household-audit.service";

function makeBills(overrides: Partial<HouseholdBillRepository> = {}): HouseholdBillRepository {
  return {
    findAllByUser: jest.fn(),
    findActiveByUser: jest.fn().mockResolvedValue([]),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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

describe("HouseholdBillsService.remove", () => {
  it("deletes the bill unconditionally, without checking for existing competências first", async () => {
    const bill = { id: "bill-1", userId: "user-1", name: "Energia" };
    const deleteFn = jest.fn().mockResolvedValue(undefined);
    const bills = makeBills({ findById: jest.fn().mockResolvedValue(bill), delete: deleteFn });
    const entries = makeEntries();
    const audit = makeAudit();
    const service = new HouseholdBillsService(bills, entries, audit);

    const result = await service.remove("user-1", "bill-1");

    expect(deleteFn).toHaveBeenCalledWith("bill-1");
    expect(audit.log).toHaveBeenCalledWith("user-1", "HouseholdBill", "bill-1", "DELETE", bill, null);
    expect(result).toEqual({ id: "bill-1" });
  });
});
