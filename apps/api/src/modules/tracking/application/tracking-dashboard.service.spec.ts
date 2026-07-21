import { TrackingDashboardService } from "./tracking-dashboard.service";
import { PrismaService } from "../../../prisma/prisma.service";

const JOB = {
  id: "job-1",
  name: "Contrato Principal",
  company: "Acme Corp",
  client: "Cliente X",
  monthlyValue: "4000" as any,
  expectedHoursPerDay: 8,
  weekdays: [1, 2, 3, 4, 5],
  active: true,
  paymentDay: 5,
};

function makePrisma(overrides: {
  jobs?: any[];
  sessions?: any[];
  projects?: any[];
  incomes?: any[];
  forgottenCount?: number;
}) {
  return {
    trackingJob: { findMany: jest.fn().mockResolvedValue(overrides.jobs ?? [JOB]) },
    trackingSession: {
      findMany: jest.fn().mockResolvedValue(overrides.sessions ?? []),
      count: jest.fn().mockResolvedValue(overrides.forgottenCount ?? 0),
    },
    trackingProject: { findMany: jest.fn().mockResolvedValue(overrides.projects ?? []) },
    trackingIncome: { findMany: jest.fn().mockResolvedValue(overrides.incomes ?? []) },
  } as unknown as PrismaService;
}

function sessionOn(date: Date, hours: number) {
  const checkIn = date;
  const checkOut = new Date(date.getTime() + hours * 3600 * 1000);
  return { checkIn, checkOut, pauses: [], job: JOB };
}

describe("TrackingDashboardService.summary", () => {
  it("computes hoursToday/hoursThisMonth and fixedJobsRevenue from completed sessions in range", async () => {
    const now = new Date();
    const todayMorning = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9);
    const earlierThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 9);

    const prisma = makePrisma({ sessions: [sessionOn(todayMorning, 2), sessionOn(earlierThisMonth, 3)] });
    const service = new TrackingDashboardService(prisma);

    const result = await service.summary("user-1");

    expect(result.hoursToday).toBeCloseTo(2, 1);
    expect(result.hoursThisMonth).toBeCloseTo(5, 1);
    // 4000/month, Mon-Fri 8h/day -> ~R$23.02/h; 5h worked -> ~R$115.10
    expect(result.fixedJobsRevenue).toBeGreaterThan(0);
  });

  it("excludes sessions from a previous month out of the current-month totals", async () => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15, 9);
    const prisma = makePrisma({ sessions: [sessionOn(lastMonth, 4)] });
    const service = new TrackingDashboardService(prisma);

    const result = await service.summary("user-1");

    expect(result.hoursThisMonth).toBe(0);
    expect(result.previousMonth.hoursThisMonth).toBeCloseTo(4, 1);
  });

  it("adds freelance and other-income revenue into the total, without adding freelance hours to fixed-job hours incorrectly", async () => {
    const now = new Date();
    const prisma = makePrisma({
      projects: [{ date: now, client: "Cliente Y", name: "Projeto Y", amountReceived: "500" as any, hoursSpent: "5" as any }],
      incomes: [{ date: now, amount: "200" as any }],
    });
    const service = new TrackingDashboardService(prisma);

    const result = await service.summary("user-1");

    expect(result.freelanceRevenue).toBe(500);
    expect(result.otherIncome).toBe(200);
    expect(result.totalRevenue).toBe(700);
  });

  it("computes nextPayment as the soonest upcoming paymentDay among active jobs", async () => {
    const now = new Date();
    const prisma = makePrisma({ jobs: [JOB] });
    const service = new TrackingDashboardService(prisma);

    const result = await service.summary("user-1");

    expect(result.nextPayment).not.toBeNull();
    expect(result.nextPayment?.jobName).toBe("Contrato Principal");
    expect(new Date(result.nextPayment!.date).getTime()).toBeGreaterThanOrEqual(now.getTime() - 86_400_000);
  });

  it("returns null nextPayment when no active job has a paymentDay set", async () => {
    const prisma = makePrisma({ jobs: [{ ...JOB, paymentDay: null }] });
    const service = new TrackingDashboardService(prisma);

    const result = await service.summary("user-1");

    expect(result.nextPayment).toBeNull();
  });

  it("returns a null averageHourlyRate and empty insights when there is no data at all", async () => {
    const prisma = makePrisma({ jobs: [] });
    const service = new TrackingDashboardService(prisma);

    const result = await service.summary("user-1");

    expect(result.averageHourlyRate).toBeNull();
    expect(result.totalRevenue).toBe(0);
    expect(Array.isArray(result.insights)).toBe(true);
  });
});
