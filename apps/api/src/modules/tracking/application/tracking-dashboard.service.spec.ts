import { TrackingDashboardService } from "./tracking-dashboard.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { TrackingFxService } from "./tracking-fx.service";
import { TrackingJobPaymentRepository } from "../domain/tracking-job-payment.repository";

const JOB = {
  id: "job-1",
  type: "FIXO" as const,
  name: "Contrato Principal",
  company: "Acme Corp",
  client: "Cliente X",
  monthlyValue: "4000" as any,
  totalAgreedValue: null,
  currency: "BRL" as const,
  expectedHoursPerDay: 8,
  weekdays: [1, 2, 3, 4, 5],
  active: true,
  paymentDay: 5,
};

const FREELANCE_JOB = {
  id: "job-freelance-1",
  type: "FREELANCE" as const,
  name: "Projeto Y",
  company: "Cliente Y",
  client: "Cliente Y",
  monthlyValue: null,
  totalAgreedValue: "500" as any,
  currency: "BRL" as const,
  expectedHoursPerDay: 8,
  weekdays: [1, 2, 3, 4, 5],
  active: true,
  paymentDay: null,
};

function makeFx(): TrackingFxService {
  return { getUsdToBrlRate: jest.fn().mockResolvedValue(5) } as unknown as TrackingFxService;
}

function makeJobPayments(): TrackingJobPaymentRepository {
  return {
    findForJobsAndMonth: jest.fn().mockResolvedValue(new Map()),
    findByJobAndMonth: jest.fn(),
    upsert: jest.fn(),
    findAllByJob: jest.fn(),
  } as unknown as TrackingJobPaymentRepository;
}

function makePrisma(overrides: { jobs?: any[]; sessions?: any[]; incomes?: any[]; forgottenCount?: number }) {
  return {
    trackingJob: { findMany: jest.fn().mockResolvedValue(overrides.jobs ?? [JOB]) },
    trackingSession: {
      findMany: jest.fn().mockResolvedValue(overrides.sessions ?? []),
      count: jest.fn().mockResolvedValue(overrides.forgottenCount ?? 0),
    },
    trackingIncome: { findMany: jest.fn().mockResolvedValue(overrides.incomes ?? []) },
  } as unknown as PrismaService;
}

function sessionOn(date: Date, hours: number) {
  const checkIn = date;
  const checkOut = new Date(date.getTime() + hours * 3600 * 1000);
  return { jobId: JOB.id, checkIn, checkOut, pauses: [], job: JOB };
}

describe("TrackingDashboardService.summary", () => {
  it("computes hoursToday/hoursThisMonth and fixedJobsRevenue from completed sessions in range", async () => {
    const now = new Date();
    const todayMorning = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9);
    const earlierThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 9);

    const prisma = makePrisma({ sessions: [sessionOn(todayMorning, 2), sessionOn(earlierThisMonth, 3)] });
    const service = new TrackingDashboardService(prisma, makeFx(), makeJobPayments());

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
    const service = new TrackingDashboardService(prisma, makeFx(), makeJobPayments());

    const result = await service.summary("user-1");

    expect(result.hoursThisMonth).toBe(0);
    expect(result.previousMonth.hoursThisMonth).toBeCloseTo(4, 1);
  });

  it("adds freelance and other-income revenue into the total, without adding freelance hours to fixed-job hours incorrectly", async () => {
    const now = new Date();
    const freelanceSession = { jobId: FREELANCE_JOB.id, checkIn: now, checkOut: new Date(now.getTime() + 5 * 3600 * 1000), pauses: [], job: FREELANCE_JOB };
    const prisma = makePrisma({
      jobs: [FREELANCE_JOB],
      sessions: [freelanceSession],
      incomes: [{ date: now, amount: "200" as any }],
    });
    const service = new TrackingDashboardService(prisma, makeFx(), makeJobPayments());

    const result = await service.summary("user-1");

    expect(result.freelanceRevenue).toBe(500);
    expect(result.fixedJobsRevenue).toBe(0);
    expect(result.otherIncome).toBe(200);
    expect(result.totalRevenue).toBe(700);
  });

  it("computes nextPayment as the soonest upcoming paymentDay among active jobs", async () => {
    const now = new Date();
    const prisma = makePrisma({ jobs: [JOB] });
    const service = new TrackingDashboardService(prisma, makeFx(), makeJobPayments());

    const result = await service.summary("user-1");

    expect(result.nextPayment).not.toBeNull();
    expect(result.nextPayment?.jobName).toBe("Contrato Principal");
    expect(new Date(result.nextPayment!.date).getTime()).toBeGreaterThanOrEqual(now.getTime() - 86_400_000);
  });

  it("returns null nextPayment when no active job has a paymentDay set", async () => {
    const prisma = makePrisma({ jobs: [{ ...JOB, paymentDay: null }] });
    const service = new TrackingDashboardService(prisma, makeFx(), makeJobPayments());

    const result = await service.summary("user-1");

    expect(result.nextPayment).toBeNull();
  });

  it("returns a null averageHourlyRate and empty insights when there is no data at all", async () => {
    const prisma = makePrisma({ jobs: [] });
    const service = new TrackingDashboardService(prisma, makeFx(), makeJobPayments());

    const result = await service.summary("user-1");

    expect(result.averageHourlyRate).toBeNull();
    expect(result.totalRevenue).toBe(0);
    expect(Array.isArray(result.insights)).toBe(true);
  });

  it("uses the confirmed monthly payment instead of the session estimate once one exists for this month", async () => {
    const now = new Date();
    const todayMorning = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9);
    const prisma = makePrisma({ sessions: [sessionOn(todayMorning, 5)] });
    const jobPayments = {
      findForJobsAndMonth: jest.fn().mockResolvedValue(new Map([["job-1", 6000]])),
      findByJobAndMonth: jest.fn(),
      upsert: jest.fn(),
      findAllByJob: jest.fn(),
    } as unknown as TrackingJobPaymentRepository;
    const service = new TrackingDashboardService(prisma, makeFx(), jobPayments);

    const result = await service.summary("user-1");

    expect(result.fixedJobsRevenue).toBe(6000);
    expect(result.revenueByClient[0]).toEqual({ client: "Cliente X", amount: 6000 });
  });

  it("converts a USD job's session value to BRL using the live exchange rate", async () => {
    const now = new Date();
    const todayMorning = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9);
    const usdJob = { ...JOB, currency: "USD" as const, monthlyValue: "1000" as any };
    const prisma = makePrisma({ jobs: [usdJob], sessions: [{ ...sessionOn(todayMorning, 8), job: usdJob }] });
    const fx = { getUsdToBrlRate: jest.fn().mockResolvedValue(5) } as unknown as TrackingFxService;
    const service = new TrackingDashboardService(prisma, fx, makeJobPayments());

    const result = await service.summary("user-1");

    expect(fx.getUsdToBrlRate).toHaveBeenCalled();
    // 1000 USD * 5 = 5000 BRL/month, Mon-Fri 8h/day -> ~28.77/h; 8h worked -> ~230.16
    expect(result.fixedJobsRevenue).toBeGreaterThan(0);
    expect(result.fixedJobsRevenue).toBeLessThan(300);
  });
});
