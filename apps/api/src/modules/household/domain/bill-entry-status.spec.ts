import { computeBillEntryStatus } from "./bill-entry-status";

const DUE_DATE = new Date("2026-07-15T12:00:00");
const BEFORE_DUE = new Date("2026-07-10T12:00:00");
const AFTER_DUE = new Date("2026-07-20T12:00:00");

describe("computeBillEntryStatus", () => {
  it("returns PENDING when nothing has been reserved or paid, before the due date", () => {
    expect(computeBillEntryStatus({ amount: 180, reservedAmount: 0, paidAmount: 0, dueDate: DUE_DATE, asOf: BEFORE_DUE })).toBe(
      "PENDING",
    );
  });

  it("returns PARTIALLY_RESERVED when some but not all of the amount was reserved", () => {
    expect(computeBillEntryStatus({ amount: 180, reservedAmount: 100, paidAmount: 0, dueDate: DUE_DATE, asOf: BEFORE_DUE })).toBe(
      "PARTIALLY_RESERVED",
    );
  });

  it("returns RESERVED when the full amount was reserved but not paid", () => {
    expect(computeBillEntryStatus({ amount: 180, reservedAmount: 180, paidAmount: 0, dueDate: DUE_DATE, asOf: BEFORE_DUE })).toBe(
      "RESERVED",
    );
  });

  it("returns PAID once paidAmount reaches the full amount, regardless of reservedAmount", () => {
    expect(computeBillEntryStatus({ amount: 180, reservedAmount: 180, paidAmount: 180, dueDate: DUE_DATE, asOf: BEFORE_DUE })).toBe(
      "PAID",
    );
    expect(computeBillEntryStatus({ amount: 180, reservedAmount: 0, paidAmount: 180, dueDate: DUE_DATE, asOf: BEFORE_DUE })).toBe(
      "PAID",
    );
  });

  it("returns LATE when the due date has passed and it still isn't fully paid", () => {
    expect(computeBillEntryStatus({ amount: 180, reservedAmount: 180, paidAmount: 0, dueDate: DUE_DATE, asOf: AFTER_DUE })).toBe(
      "LATE",
    );
    expect(computeBillEntryStatus({ amount: 180, reservedAmount: 0, paidAmount: 0, dueDate: DUE_DATE, asOf: AFTER_DUE })).toBe(
      "LATE",
    );
  });

  it("PAID takes priority over LATE — paying after the due date still counts as paid, not late", () => {
    expect(computeBillEntryStatus({ amount: 180, reservedAmount: 0, paidAmount: 180, dueDate: DUE_DATE, asOf: AFTER_DUE })).toBe(
      "PAID",
    );
  });

  it("reserved and paid are independent — a partial payment with nothing reserved doesn't bump the status", () => {
    expect(computeBillEntryStatus({ amount: 180, reservedAmount: 0, paidAmount: 100, dueDate: DUE_DATE, asOf: BEFORE_DUE })).toBe(
      "PENDING",
    );
  });
});
