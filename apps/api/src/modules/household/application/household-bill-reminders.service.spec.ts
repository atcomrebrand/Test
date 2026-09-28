import { HouseholdBillRemindersService } from "./household-bill-reminders.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    householdBillEntry: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  } as unknown as PrismaService;
}

function makeNotifications(): NotificationsService {
  return { notifyIfNew: jest.fn().mockResolvedValue(undefined) } as unknown as NotificationsService;
}

const NOW = new Date("2026-07-15T10:00:00");

describe("HouseholdBillRemindersService.checkDueReminders", () => {
  it("notifies 'vence hoje' for an entry due later today", async () => {
    const entry = {
      id: "e1",
      userId: "user-1",
      amount: 180,
      dueDate: new Date("2026-07-15T12:00:00"),
      bill: { name: "Energia" },
    };
    const prisma = makePrisma({ householdBillEntry: { findMany: jest.fn().mockResolvedValue([entry]) } });
    const notifications = makeNotifications();
    const service = new HouseholdBillRemindersService(prisma, notifications);

    await service.checkDueReminders(NOW);

    expect(notifications.notifyIfNew).toHaveBeenCalledWith(
      "user-1",
      "HOUSEHOLD_BILL_DUE",
      "Conta vence hoje: Energia",
      expect.stringContaining("Energia"),
    );
  });

  it("notifies 'vence amanhã' for an entry due tomorrow", async () => {
    const entry = {
      id: "e1",
      userId: "user-1",
      amount: 180,
      dueDate: new Date("2026-07-16T12:00:00"),
      bill: { name: "Água" },
    };
    const prisma = makePrisma({ householdBillEntry: { findMany: jest.fn().mockResolvedValue([entry]) } });
    const notifications = makeNotifications();
    const service = new HouseholdBillRemindersService(prisma, notifications);

    await service.checkDueReminders(NOW);

    expect(notifications.notifyIfNew).toHaveBeenCalledWith("user-1", "HOUSEHOLD_BILL_DUE", "Conta vence amanhã: Água", expect.any(String));
  });

  it("only queries entries not yet PAID or SKIPPED", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = makePrisma({ householdBillEntry: { findMany } });
    const notifications = makeNotifications();
    const service = new HouseholdBillRemindersService(prisma, notifications);

    await service.checkDueReminders(NOW);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { notIn: ["PAID", "SKIPPED"] } }) }),
    );
  });

  it("one entry's failure doesn't stop the rest", async () => {
    const entries = [
      { id: "e1", userId: "user-1", amount: 100, dueDate: new Date("2026-07-15T12:00:00"), bill: { name: "Conta A" } },
      { id: "e2", userId: "user-2", amount: 200, dueDate: new Date("2026-07-15T12:00:00"), bill: { name: "Conta B" } },
    ];
    const prisma = makePrisma({ householdBillEntry: { findMany: jest.fn().mockResolvedValue(entries) } });
    const notifyIfNew = jest.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined);
    const notifications = { notifyIfNew } as unknown as NotificationsService;
    const service = new HouseholdBillRemindersService(prisma, notifications);

    await service.checkDueReminders(NOW);

    expect(notifyIfNew).toHaveBeenCalledTimes(2);
  });
});
