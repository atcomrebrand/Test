import { HouseholdMonthCompletionService } from "./household-month-completion.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    householdBillEntry: { findMany: jest.fn().mockResolvedValue([]) },
    householdCardEntry: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  } as unknown as PrismaService;
}

function makeNotifications(): NotificationsService {
  return { notifyIfNew: jest.fn().mockResolvedValue(undefined) } as unknown as NotificationsService;
}

describe("HouseholdMonthCompletionService.checkAndNotify", () => {
  it("notifies when every bill is PAID or SKIPPED and every card is paid", async () => {
    const prisma = makePrisma({
      householdBillEntry: { findMany: jest.fn().mockResolvedValue([{ status: "PAID" }, { status: "SKIPPED" }]) },
      householdCardEntry: { findMany: jest.fn().mockResolvedValue([{ paid: true }]) },
    });
    const notifications = makeNotifications();
    const service = new HouseholdMonthCompletionService(prisma, notifications);

    await service.checkAndNotify("user-1", 2026, 7);

    expect(notifications.notifyIfNew).toHaveBeenCalledWith(
      "user-1",
      "HOUSEHOLD_MONTH_FULLY_PAID",
      "Julho 100% pago!",
      expect.stringContaining("descanse"),
    );
  });

  it("does not notify when a bill is still pending", async () => {
    const prisma = makePrisma({
      householdBillEntry: { findMany: jest.fn().mockResolvedValue([{ status: "PAID" }, { status: "PENDING" }]) },
      householdCardEntry: { findMany: jest.fn().mockResolvedValue([{ paid: true }]) },
    });
    const notifications = makeNotifications();
    const service = new HouseholdMonthCompletionService(prisma, notifications);

    await service.checkAndNotify("user-1", 2026, 7);

    expect(notifications.notifyIfNew).not.toHaveBeenCalled();
  });

  it("does not notify when a card invoice is still unpaid", async () => {
    const prisma = makePrisma({
      householdBillEntry: { findMany: jest.fn().mockResolvedValue([{ status: "PAID" }]) },
      householdCardEntry: { findMany: jest.fn().mockResolvedValue([{ paid: false }]) },
    });
    const notifications = makeNotifications();
    const service = new HouseholdMonthCompletionService(prisma, notifications);

    await service.checkAndNotify("user-1", 2026, 7);

    expect(notifications.notifyIfNew).not.toHaveBeenCalled();
  });

  it("does not notify when the month has no bills and no cards at all", async () => {
    const prisma = makePrisma();
    const notifications = makeNotifications();
    const service = new HouseholdMonthCompletionService(prisma, notifications);

    await service.checkAndNotify("user-1", 2026, 7);

    expect(notifications.notifyIfNew).not.toHaveBeenCalled();
  });

  it("swallows errors instead of throwing, so a failed check never breaks the caller's write", async () => {
    const prisma = makePrisma({ householdBillEntry: { findMany: jest.fn().mockRejectedValue(new Error("boom")) } });
    const notifications = makeNotifications();
    const service = new HouseholdMonthCompletionService(prisma, notifications);

    await expect(service.checkAndNotify("user-1", 2026, 7)).resolves.toBeUndefined();
  });
});
