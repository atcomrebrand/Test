import { TrackingCalendarService } from "./tracking-calendar.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TrackingFxService } from "./tracking-fx.service";

const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

function makeFx(): TrackingFxService {
  return { getUsdToBrlRate: jest.fn().mockResolvedValue(5) } as unknown as TrackingFxService;
}

function makePrisma(overrides: { sessions?: any[]; jobs?: any[] }) {
  return {
    trackingSession: { findMany: jest.fn().mockResolvedValue(overrides.sessions ?? []) },
    trackingJob: { findMany: jest.fn().mockResolvedValue(overrides.jobs ?? []) },
  } as unknown as PrismaService;
}

function job(overrides: Partial<{ name: string; daysOff: string[]; weekdays: number[]; startDate: Date; endDate: Date | null }> = {}) {
  return {
    name: "Contrato Principal",
    daysOff: [],
    weekdays: ALL_WEEKDAYS,
    startDate: new Date("2026-01-01T12:00:00"),
    endDate: null,
    ...overrides,
  };
}

function weekendDatesInMonth(year: number, month: number): string[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const dates: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const weekday = new Date(year, month - 1, day).getDay();
    if (weekday === 0 || weekday === 6) dates.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return dates;
}

describe("TrackingCalendarService.month — daysOff", () => {
  it("marks an explicit day off even when nothing was worked that day", async () => {
    const prisma = makePrisma({ jobs: [job({ daysOff: ["2026-07-15"] })] });
    const service = new TrackingCalendarService(prisma, makeFx());

    const result = await service.month("user-1", 2026, 7);

    expect(result).toEqual([{ date: "2026-07-15", hours: 0, revenue: 0, sessions: [], daysOff: ["Contrato Principal"], bestPlacement: null }]);
  });

  it("combines multiple jobs' days off onto the same date", async () => {
    const prisma = makePrisma({
      jobs: [job({ name: "Contrato A", daysOff: ["2026-07-15"] }), job({ name: "Contrato B", daysOff: ["2026-07-15"] })],
    });
    const service = new TrackingCalendarService(prisma, makeFx());

    const result = await service.month("user-1", 2026, 7);

    expect(result).toEqual([{ date: "2026-07-15", hours: 0, revenue: 0, sessions: [], daysOff: ["Contrato A", "Contrato B"], bestPlacement: null }]);
  });

  it("marks weekends as folga automatically for a Mon-Fri job, with no explicit daysOff", async () => {
    const prisma = makePrisma({ jobs: [job({ weekdays: [1, 2, 3, 4, 5] })] });
    const service = new TrackingCalendarService(prisma, makeFx());

    const result = await service.month("user-1", 2026, 7);

    expect(result.map((d) => d.date)).toEqual(weekendDatesInMonth(2026, 7));
    expect(result.every((d) => d.daysOff.includes("Contrato Principal"))).toBe(true);
  });

  it("also marks an explicit day off that falls on an otherwise-worked weekday", async () => {
    const prisma = makePrisma({ jobs: [job({ weekdays: [1, 2, 3, 4, 5], daysOff: ["2026-07-15"] })] }); // a Wednesday
    const service = new TrackingCalendarService(prisma, makeFx());

    const result = await service.month("user-1", 2026, 7);

    const weekdayOffDates = weekendDatesInMonth(2026, 7);
    expect(result.map((d) => d.date).sort()).toEqual([...weekdayOffDates, "2026-07-15"].sort());
  });

  it("does not mark days before startDate or after endDate", async () => {
    const prisma = makePrisma({
      jobs: [
        job({
          weekdays: ALL_WEEKDAYS,
          daysOff: ["2026-07-05", "2026-07-15", "2026-07-25"],
          startDate: new Date("2026-07-10T12:00:00"),
          endDate: new Date("2026-07-20T12:00:00"),
        }),
      ],
    });
    const service = new TrackingCalendarService(prisma, makeFx());

    const result = await service.month("user-1", 2026, 7);

    expect(result.map((d) => d.date)).toEqual(["2026-07-15"]);
  });

  it("queries only active FIXO jobs", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = makePrisma({});
    (prisma.trackingJob.findMany as jest.Mock) = findMany;
    const service = new TrackingCalendarService(prisma, makeFx());

    await service.month("user-1", 2026, 7);

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", deletedAt: null, active: true, type: "FIXO" },
      select: { name: true, daysOff: true, weekdays: true, startDate: true, endDate: true },
    });
  });
});
