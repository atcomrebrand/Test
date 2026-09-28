import { resolveDueDate } from "./resolve-due-date";

describe("resolveDueDate", () => {
  it("uses dueDay as-is when it fits in the month", () => {
    const date = resolveDueDate(2026, 7, 15);
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 6, 15]);
  });

  it("clamps dueDay=31 to the last day of a 30-day month", () => {
    const date = resolveDueDate(2026, 4, 31);
    expect(date.getDate()).toBe(30);
  });

  it("clamps dueDay=31 to 28 in a non-leap February", () => {
    const date = resolveDueDate(2026, 2, 31);
    expect(date.getDate()).toBe(28);
  });

  it("clamps dueDay=31 to 29 in a leap February", () => {
    const date = resolveDueDate(2028, 2, 31);
    expect(date.getDate()).toBe(29);
  });
});
