import { TrackingScheduleRemindersService } from "./tracking-schedule-reminders.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { NotificationsService } from "../../notifications/notifications.service";

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    trackingJob: { findMany: jest.fn().mockResolvedValue([]) },
    trackingSession: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  } as unknown as PrismaService;
}

function makeNotifications(): NotificationsService {
  return { notifyIfNew: jest.fn().mockResolvedValue(undefined) } as unknown as NotificationsService;
}

const NOW = new Date();
const HHMM = `${NOW.getHours().toString().padStart(2, "0")}:${NOW.getMinutes().toString().padStart(2, "0")}`;
const WEEKDAY = NOW.getDay();

describe("TrackingScheduleRemindersService.checkStartReminders", () => {
  it("notifies when a job's expectedStartTime matches now and there's no active session", async () => {
    const job = { id: "j1", userId: "user-1", name: "Dev Backend", company: "Acme Corp", weekdays: [WEEKDAY] };
    const prisma = makePrisma({ trackingJob: { findMany: jest.fn().mockResolvedValue([job]) } });
    const notifications = makeNotifications();
    const service = new TrackingScheduleRemindersService(prisma, notifications);

    await service.checkStartReminders(NOW);

    expect(notifications.notifyIfNew).toHaveBeenCalledWith(
      "user-1",
      "TRACKING_START_REMINDER",
      "Hora de iniciar: Dev Backend",
      expect.stringContaining("Acme Corp"),
    );
  });

  it("does not notify when there's already an active session for that job", async () => {
    const job = { id: "j1", userId: "user-1", name: "Dev Backend", company: "Acme Corp", weekdays: [WEEKDAY] };
    const prisma = makePrisma({
      trackingJob: { findMany: jest.fn().mockResolvedValue([job]) },
      trackingSession: { findFirst: jest.fn().mockResolvedValue({ id: "s1" }), findMany: jest.fn(), update: jest.fn() },
    });
    const notifications = makeNotifications();
    const service = new TrackingScheduleRemindersService(prisma, notifications);

    await service.checkStartReminders(NOW);

    expect(notifications.notifyIfNew).not.toHaveBeenCalled();
  });

  it("queries active/non-deleted jobs whose expectedStartTime and weekday match right now", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = makePrisma({ trackingJob: { findMany } });
    const notifications = makeNotifications();
    const service = new TrackingScheduleRemindersService(prisma, notifications);

    await service.checkStartReminders(NOW);

    expect(findMany).toHaveBeenCalledWith({
      where: { active: true, deletedAt: null, expectedStartTime: HHMM, weekdays: { has: WEEKDAY } },
    });
    expect(notifications.notifyIfNew).not.toHaveBeenCalled();
  });

  it("one job's failure doesn't stop the rest", async () => {
    const jobs = [
      { id: "j1", userId: "user-1", name: "Dev Backend", company: "Acme Corp", weekdays: [WEEKDAY] },
      { id: "j2", userId: "user-2", name: "Freela EUA", company: "Acme Inc", weekdays: [WEEKDAY] },
    ];
    const findFirst = jest.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(null);
    const prisma = makePrisma({
      trackingJob: { findMany: jest.fn().mockResolvedValue(jobs) },
      trackingSession: { findFirst, findMany: jest.fn(), update: jest.fn() },
    });
    const notifications = makeNotifications();
    const service = new TrackingScheduleRemindersService(prisma, notifications);

    await service.checkStartReminders(NOW);

    expect(notifications.notifyIfNew).toHaveBeenCalledTimes(1);
    expect(notifications.notifyIfNew).toHaveBeenCalledWith("user-2", "TRACKING_START_REMINDER", expect.any(String), expect.any(String));
  });
});

describe("TrackingScheduleRemindersService.checkEndReminders", () => {
  it("notifies and marks endReminderSentAt when netSeconds reaches expectedHoursPerDay (no fixed expectedEndTime)", async () => {
    const session = {
      id: "s1",
      userId: "user-1",
      checkIn: new Date(NOW.getTime() - 9 * 3600 * 1000),
      pauses: [],
      job: { name: "Dev Backend", company: "Acme Corp", expectedEndTime: null, expectedHoursPerDay: 8 },
    };
    const update = jest.fn().mockResolvedValue(undefined);
    const prisma = makePrisma({ trackingSession: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([session]), update } });
    const notifications = makeNotifications();
    const service = new TrackingScheduleRemindersService(prisma, notifications);

    await service.checkEndReminders(NOW);

    expect(notifications.notifyIfNew).toHaveBeenCalledWith(
      "user-1",
      "TRACKING_END_REMINDER",
      "Hora de encerrar: Dev Backend",
      expect.stringContaining("9h00"),
    );
    expect(update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { endReminderSentAt: expect.any(Date) } });
  });

  it("does not notify when netSeconds hasn't reached expectedHoursPerDay yet and there's no fixed expectedEndTime", async () => {
    const session = {
      id: "s1",
      userId: "user-1",
      checkIn: new Date(NOW.getTime() - 2 * 3600 * 1000),
      pauses: [],
      job: { name: "Dev Backend", company: "Acme Corp", expectedEndTime: null, expectedHoursPerDay: 8 },
    };
    const prisma = makePrisma({ trackingSession: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([session]), update: jest.fn() } });
    const notifications = makeNotifications();
    const service = new TrackingScheduleRemindersService(prisma, notifications);

    await service.checkEndReminders(NOW);

    expect(notifications.notifyIfNew).not.toHaveBeenCalled();
  });

  it("notifies when now matches a fixed expectedEndTime, regardless of hours worked", async () => {
    const session = {
      id: "s1",
      userId: "user-1",
      checkIn: new Date(NOW.getTime() - 30 * 60 * 1000),
      pauses: [],
      job: { name: "Dev Backend", company: "Acme Corp", expectedEndTime: HHMM, expectedHoursPerDay: 8 },
    };
    const prisma = makePrisma({ trackingSession: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue([session]), update: jest.fn() } });
    const notifications = makeNotifications();
    const service = new TrackingScheduleRemindersService(prisma, notifications);

    await service.checkEndReminders(NOW);

    expect(notifications.notifyIfNew).toHaveBeenCalledWith("user-1", "TRACKING_END_REMINDER", expect.any(String), expect.any(String));
  });

  it("one session's failure doesn't stop the rest", async () => {
    const jobData = { name: "Dev Backend", company: "Acme Corp", expectedEndTime: null, expectedHoursPerDay: 8 };
    const sessions = [
      { id: "s1", userId: "user-1", checkIn: new Date(NOW.getTime() - 9 * 3600 * 1000), pauses: [], job: jobData },
      { id: "s2", userId: "user-2", checkIn: new Date(NOW.getTime() - 9 * 3600 * 1000), pauses: [], job: jobData },
    ];
    const update = jest.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined);
    const prisma = makePrisma({ trackingSession: { findFirst: jest.fn(), findMany: jest.fn().mockResolvedValue(sessions), update } });
    const notifications = makeNotifications();
    const service = new TrackingScheduleRemindersService(prisma, notifications);

    await service.checkEndReminders(NOW);

    expect(notifications.notifyIfNew).toHaveBeenCalledTimes(2);
  });
});
