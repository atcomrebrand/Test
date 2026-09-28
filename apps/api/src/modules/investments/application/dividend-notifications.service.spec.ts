import { DividendNotificationsService } from "./dividend-notifications.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { DividendsService } from "./dividends.service";
import { NotificationsService } from "../../notifications/notifications.service";

function makePrisma(users: { id: string }[] = []) {
  return { user: { findMany: jest.fn().mockResolvedValue(users) } } as unknown as PrismaService;
}

function makeDividends(calendar: unknown[] = []): DividendsService {
  return { getPortfolioCalendar: jest.fn().mockResolvedValue(calendar) } as unknown as DividendsService;
}

function makeNotifications(): NotificationsService {
  return { notifyIfNew: jest.fn().mockResolvedValue(undefined) } as unknown as NotificationsService;
}

const TODAY = new Date().toISOString().slice(0, 10);

describe("DividendNotificationsService.notifyForUser", () => {
  it("notifies for a calendar entry whose paymentDate is today, with the ticker, asset name and formatted amount", async () => {
    const calendar = [
      { ticker: "PETR4", name: "Petrobras", paymentDate: TODAY, exDate: "2026-07-01", estimatedAmount: 45.2, quantityHeld: 100 },
    ];
    const notifications = makeNotifications();
    const service = new DividendNotificationsService(makePrisma(), makeDividends(calendar), notifications);

    await service.notifyForUser("user-1");

    expect(notifications.notifyIfNew).toHaveBeenCalledWith(
      "user-1",
      "DIVIDEND_PAYMENT",
      "Provento chegando: PETR4",
      expect.stringContaining("Petrobras (PETR4)"),
    );
    expect(notifications.notifyIfNew).toHaveBeenCalledWith(
      "user-1",
      "DIVIDEND_PAYMENT",
      "Provento chegando: PETR4",
      expect.stringContaining("R$"),
    );
  });

  it("does not notify for an entry whose payment date isn't today", async () => {
    const calendar = [{ ticker: "PETR4", name: "Petrobras", paymentDate: "2020-01-01", exDate: "2019-12-01", estimatedAmount: 45.2, quantityHeld: 100 }];
    const notifications = makeNotifications();
    const service = new DividendNotificationsService(makePrisma(), makeDividends(calendar), notifications);

    await service.notifyForUser("user-1");

    expect(notifications.notifyIfNew).not.toHaveBeenCalled();
  });

  it("does not notify for an entry with no estimatedAmount", async () => {
    const calendar = [{ ticker: "PETR4", name: "Petrobras", paymentDate: TODAY, exDate: "2026-07-01", estimatedAmount: null, quantityHeld: null }];
    const notifications = makeNotifications();
    const service = new DividendNotificationsService(makePrisma(), makeDividends(calendar), notifications);

    await service.notifyForUser("user-1");

    expect(notifications.notifyIfNew).not.toHaveBeenCalled();
  });

  it("falls back to the ticker alone when the asset has no name on file", async () => {
    const calendar = [{ ticker: "MXRF11", name: null, paymentDate: TODAY, exDate: "2026-07-01", estimatedAmount: 12.5, quantityHeld: 50 }];
    const notifications = makeNotifications();
    const service = new DividendNotificationsService(makePrisma(), makeDividends(calendar), notifications);

    await service.notifyForUser("user-1");

    expect(notifications.notifyIfNew).toHaveBeenCalledWith(
      "user-1",
      "DIVIDEND_PAYMENT",
      "Provento chegando: MXRF11",
      expect.not.stringContaining("null"),
    );
  });
});

describe("DividendNotificationsService.notifyTodaysPayments", () => {
  it("sweeps every user, and one user's failure doesn't stop the rest", async () => {
    const notifications = makeNotifications();
    const dividends = makeDividends();
    const service = new DividendNotificationsService(makePrisma([{ id: "u1" }, { id: "u2" }]), dividends, notifications);
    const spy = jest.spyOn(service, "notifyForUser").mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined);

    await service.notifyTodaysPayments();

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, "u1");
    expect(spy).toHaveBeenNthCalledWith(2, "u2");
  });
});
