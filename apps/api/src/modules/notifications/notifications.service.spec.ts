import { NotificationsService } from "./notifications.service";
import { PrismaService } from "../../prisma/prisma.service";
import { PushService } from "../push/push.service";

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    setting: { findUnique: jest.fn().mockResolvedValue(null) },
    card: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
    installment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
    notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  } as unknown as PrismaService;
}

function makePush() {
  return { notifyUser: jest.fn().mockResolvedValue(undefined) } as unknown as PushService;
}

describe("NotificationsService", () => {
  describe("createIfNotExists → push wiring", () => {
    it("sends a push only when a genuinely new notification is created, not when one already exists today", async () => {
      const settings = { alertLimitWarning: true, limitWarningPct: 80, alertSpendingJump: false };
      const card = { id: "card-1", name: "Nubank", limitAmount: "1000" };
      const prisma = makePrisma({
        setting: { findUnique: jest.fn().mockResolvedValue(settings) },
        card: { findMany: jest.fn().mockResolvedValue([card]), findUnique: jest.fn() },
        installment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 900 } }) },
        notification: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: "n1" }) },
      });
      const push = makePush();
      const service = new NotificationsService(prisma, push);

      await service.generate("user-1");

      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(push.notifyUser).toHaveBeenCalledWith("user-1", expect.objectContaining({ title: expect.stringContaining("Nubank") }));
    });

    it("does not push again when today's notification of that type/title already exists", async () => {
      const settings = { alertLimitWarning: true, limitWarningPct: 80, alertSpendingJump: false };
      const card = { id: "card-1", name: "Nubank", limitAmount: "1000" };
      const prisma = makePrisma({
        setting: { findUnique: jest.fn().mockResolvedValue(settings) },
        card: { findMany: jest.fn().mockResolvedValue([card]), findUnique: jest.fn() },
        installment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 900 } }) },
        notification: { findFirst: jest.fn().mockResolvedValue({ id: "existing" }), create: jest.fn() },
      });
      const push = makePush();
      const service = new NotificationsService(prisma, push);

      await service.generate("user-1");

      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(push.notifyUser).not.toHaveBeenCalled();
    });
  });

  describe("generateForAllUsers (proactive sweep, so push reaches a closed app)", () => {
    it("runs generate() for every user, and one user's failure doesn't stop the rest", async () => {
      const prisma = makePrisma({ user: { findMany: jest.fn().mockResolvedValue([{ id: "u1" }, { id: "u2" }]) } });
      const push = makePush();
      const service = new NotificationsService(prisma, push);
      const generateSpy = jest
        .spyOn(service, "generate")
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce(undefined);

      await service.generateForAllUsers();

      expect(generateSpy).toHaveBeenCalledTimes(2);
      expect(generateSpy).toHaveBeenNthCalledWith(1, "u1");
      expect(generateSpy).toHaveBeenNthCalledWith(2, "u2");
    });
  });
});
