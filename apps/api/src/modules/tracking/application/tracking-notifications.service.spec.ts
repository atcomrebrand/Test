import { TrackingNotificationsService } from "./tracking-notifications.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TrackingSessionRepository } from "../domain/tracking-session.repository";
import { TrackingJobRepository } from "../domain/tracking-job.repository";
import { NotificationsService } from "../../notifications/notifications.service";

function makePrisma(users: { id: string }[] = []) {
  return { user: { findMany: jest.fn().mockResolvedValue(users) } } as unknown as PrismaService;
}

function makeSessions(sessions: unknown[] = []): TrackingSessionRepository {
  return { findRunningOlderThan: jest.fn().mockResolvedValue(sessions) } as unknown as TrackingSessionRepository;
}

function makeJobs(jobs: unknown[] = []): TrackingJobRepository {
  return { findAllByUser: jest.fn().mockResolvedValue(jobs) } as unknown as TrackingJobRepository;
}

function makeNotifications(): NotificationsService {
  return { notifyIfNew: jest.fn().mockResolvedValue(undefined) } as unknown as NotificationsService;
}

const TODAY_DAY = new Date().getDate();
const OTHER_DAY = TODAY_DAY === 1 ? 2 : 1;

describe("TrackingNotificationsService.notifyLongRunningSessions", () => {
  it("notifies for each session returned by findRunningOlderThan, using the job name and userId", async () => {
    const sessions = [{ id: "s1", userId: "user-1", job: { name: "Empresa X" } }];
    const notifications = makeNotifications();
    const service = new TrackingNotificationsService(makePrisma(), makeSessions(sessions), makeJobs(), notifications);

    await service.notifyLongRunningSessions();

    expect(notifications.notifyIfNew).toHaveBeenCalledWith(
      "user-1",
      "TRACKING_LONG_SESSION",
      "Sessão em aberto há muito tempo",
      expect.stringContaining("Empresa X"),
    );
  });

  it("does nothing when no session is running past the cutoff", async () => {
    const notifications = makeNotifications();
    const service = new TrackingNotificationsService(makePrisma(), makeSessions([]), makeJobs(), notifications);

    await service.notifyLongRunningSessions();

    expect(notifications.notifyIfNew).not.toHaveBeenCalled();
  });

  it("one session's notification failure doesn't stop the rest", async () => {
    const sessions = [
      { id: "s1", userId: "user-1", job: { name: "Empresa X" } },
      { id: "s2", userId: "user-2", job: { name: "Empresa Y" } },
    ];
    const notifications = makeNotifications();
    (notifications.notifyIfNew as jest.Mock).mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined);
    const service = new TrackingNotificationsService(makePrisma(), makeSessions(sessions), makeJobs(), notifications);

    await service.notifyLongRunningSessions();

    expect(notifications.notifyIfNew).toHaveBeenCalledTimes(2);
  });
});

describe("TrackingNotificationsService.notifyPaymentsDueToday", () => {
  it("notifies for an active job whose paymentDay is today, with company and formatted amount", async () => {
    const jobs = [{ id: "j1", name: "Freela ACME", company: "ACME", monthlyValue: 6000, paymentDay: TODAY_DAY, active: true }];
    const notifications = makeNotifications();
    const service = new TrackingNotificationsService(makePrisma(), makeSessions(), makeJobs(jobs), notifications);

    await service.notifyPaymentsDueToday("user-1");

    expect(notifications.notifyIfNew).toHaveBeenCalledWith(
      "user-1",
      "TRACKING_PAYMENT_REMINDER",
      "Pagamento previsto hoje: Freela ACME",
      expect.stringContaining("ACME"),
    );
    expect(notifications.notifyIfNew).toHaveBeenCalledWith(
      "user-1",
      "TRACKING_PAYMENT_REMINDER",
      expect.any(String),
      expect.stringContaining("R$"),
    );
  });

  it("does not notify when paymentDay doesn't match today", async () => {
    const jobs = [{ id: "j1", name: "Freela ACME", company: "ACME", monthlyValue: 6000, paymentDay: OTHER_DAY, active: true }];
    const notifications = makeNotifications();
    const service = new TrackingNotificationsService(makePrisma(), makeSessions(), makeJobs(jobs), notifications);

    await service.notifyPaymentsDueToday("user-1");

    expect(notifications.notifyIfNew).not.toHaveBeenCalled();
  });

  it("does not notify for an inactive job even if paymentDay matches today", async () => {
    const jobs = [{ id: "j1", name: "Freela ACME", company: "ACME", monthlyValue: 6000, paymentDay: TODAY_DAY, active: false }];
    const notifications = makeNotifications();
    const service = new TrackingNotificationsService(makePrisma(), makeSessions(), makeJobs(jobs), notifications);

    await service.notifyPaymentsDueToday("user-1");

    expect(notifications.notifyIfNew).not.toHaveBeenCalled();
  });

  it("does not notify for a job with no paymentDay set", async () => {
    const jobs = [{ id: "j1", name: "Freela ACME", company: "ACME", monthlyValue: 6000, paymentDay: null, active: true }];
    const notifications = makeNotifications();
    const service = new TrackingNotificationsService(makePrisma(), makeSessions(), makeJobs(jobs), notifications);

    await service.notifyPaymentsDueToday("user-1");

    expect(notifications.notifyIfNew).not.toHaveBeenCalled();
  });
});

describe("TrackingNotificationsService.sweep", () => {
  it("checks long-running sessions once, then sweeps every user for payment reminders, continuing past a per-user failure", async () => {
    const notifications = makeNotifications();
    const service = new TrackingNotificationsService(
      makePrisma([{ id: "u1" }, { id: "u2" }]),
      makeSessions([]),
      makeJobs([]),
      notifications,
    );
    const longRunningSpy = jest.spyOn(service, "notifyLongRunningSessions").mockResolvedValue(undefined);
    const paymentsSpy = jest
      .spyOn(service, "notifyPaymentsDueToday")
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);

    await service.sweep();

    expect(longRunningSpy).toHaveBeenCalledTimes(1);
    expect(paymentsSpy).toHaveBeenCalledTimes(2);
    expect(paymentsSpy).toHaveBeenNthCalledWith(1, "u1");
    expect(paymentsSpy).toHaveBeenNthCalledWith(2, "u2");
  });
});
