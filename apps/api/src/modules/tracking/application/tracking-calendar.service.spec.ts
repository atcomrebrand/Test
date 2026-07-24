import { TrackingCalendarService } from "./tracking-calendar.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TrackingFxService } from "./tracking-fx.service";

function makeFx(): TrackingFxService {
  return { getUsdToBrlRate: jest.fn().mockResolvedValue(5) } as unknown as TrackingFxService;
}

function makePrisma(overrides: { sessions?: any[]; jobsWithDaysOff?: any[] }) {
  return {
    trackingSession: { findMany: jest.fn().mockResolvedValue(overrides.sessions ?? []) },
    trackingJob: { findMany: jest.fn().mockResolvedValue(overrides.jobsWithDaysOff ?? []) },
  } as unknown as PrismaService;
}

describe("TrackingCalendarService.month — daysOff", () => {
  it("marks a day off even when nothing was worked that day", async () => {
    const prisma = makePrisma({ jobsWithDaysOff: [{ name: "Contrato Principal", daysOff: ["2026-07-15"] }] });
    const service = new TrackingCalendarService(prisma, makeFx());

    const result = await service.month("user-1", 2026, 7);

    expect(result).toEqual([{ date: "2026-07-15", hours: 0, revenue: 0, sessions: [], daysOff: ["Contrato Principal"] }]);
  });

  it("ignores days off outside the queried month", async () => {
    const prisma = makePrisma({ jobsWithDaysOff: [{ name: "Contrato Principal", daysOff: ["2026-06-30", "2026-08-01"] }] });
    const service = new TrackingCalendarService(prisma, makeFx());

    const result = await service.month("user-1", 2026, 7);

    expect(result).toEqual([]);
  });

  it("combines multiple jobs' days off onto the same date", async () => {
    const prisma = makePrisma({
      jobsWithDaysOff: [
        { name: "Contrato A", daysOff: ["2026-07-15"] },
        { name: "Contrato B", daysOff: ["2026-07-15"] },
      ],
    });
    const service = new TrackingCalendarService(prisma, makeFx());

    const result = await service.month("user-1", 2026, 7);

    expect(result).toEqual([{ date: "2026-07-15", hours: 0, revenue: 0, sessions: [], daysOff: ["Contrato A", "Contrato B"] }]);
  });

  it("queries only jobs with a non-empty daysOff array", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = makePrisma({});
    (prisma.trackingJob.findMany as jest.Mock) = findMany;
    const service = new TrackingCalendarService(prisma, makeFx());

    await service.month("user-1", 2026, 7);

    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1", deletedAt: null, daysOff: { isEmpty: false } },
      select: { name: true, daysOff: true },
    });
  });
});
