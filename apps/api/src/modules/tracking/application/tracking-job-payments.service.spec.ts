import { ForbiddenException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { TrackingJobPaymentsService } from "./tracking-job-payments.service";
import { TrackingJobRepository } from "../domain/tracking-job.repository";
import { TrackingJobPaymentRepository } from "../domain/tracking-job-payment.repository";
import { TrackingFxService } from "./tracking-fx.service";
import { TrackingAuditService } from "./tracking-audit.service";

function makeJobs(jobs: any[] = [], byId: Record<string, any> = {}): TrackingJobRepository {
  return {
    findAllByUser: jest.fn().mockResolvedValue(jobs),
    findById: jest.fn().mockImplementation((id: string) => Promise.resolve(byId[id] ?? null)),
  } as unknown as TrackingJobRepository;
}

function makePayments(confirmedMap: Map<string, number> = new Map(), existing: any = null): TrackingJobPaymentRepository {
  return {
    findForJobsAndMonth: jest.fn().mockResolvedValue(confirmedMap),
    findByJobAndMonth: jest.fn().mockResolvedValue(existing),
    upsert: jest.fn().mockImplementation((data) => Promise.resolve({ id: "payment-1", ...data })),
    findAllByJob: jest.fn().mockResolvedValue([]),
  } as unknown as TrackingJobPaymentRepository;
}

function makeFx(rate: number | null): TrackingFxService {
  return { getUsdToBrlRate: jest.fn().mockResolvedValue(rate) } as unknown as TrackingFxService;
}

function makeAudit(): TrackingAuditService {
  return { log: jest.fn().mockResolvedValue(undefined) } as unknown as TrackingAuditService;
}

const NOW = new Date();
const YEAR = NOW.getFullYear();
const MONTH = NOW.getMonth() + 1;
const TODAY = NOW.getDate();

describe("TrackingJobPaymentsService.pending", () => {
  it("returns active jobs whose paymentDay already passed this month and aren't confirmed yet", async () => {
    const jobs = [
      { id: "j1", name: "Dev Backend", company: "Acme", currency: "BRL", monthlyValue: 6000, active: true, paymentDay: TODAY },
      { id: "j2", name: "Suporte", company: "Beta", currency: "BRL", monthlyValue: 3000, active: true, paymentDay: TODAY },
    ];
    const confirmed = new Map([["j2", 3000]]);
    const service = new TrackingJobPaymentsService(makeJobs(jobs), makePayments(confirmed), makeFx(null), makeAudit());

    const pending = await service.pending("user-1");

    expect(pending).toEqual([
      expect.objectContaining({ jobId: "j1", jobName: "Dev Backend", referenceYear: YEAR, referenceMonth: MONTH }),
    ]);
  });

  it("excludes jobs whose paymentDay hasn't arrived yet this month", async () => {
    const futureDay = TODAY === 28 ? 27 : TODAY + 1;
    const jobs = [{ id: "j1", name: "Dev Backend", company: "Acme", currency: "BRL", monthlyValue: 6000, active: true, paymentDay: futureDay }];
    const service = new TrackingJobPaymentsService(makeJobs(jobs), makePayments(), makeFx(null), makeAudit());

    const pending = await service.pending("user-1");

    expect(pending).toEqual([]);
  });

  it("excludes inactive jobs and jobs with no paymentDay set", async () => {
    const jobs = [
      { id: "j1", name: "Inativo", company: "Acme", currency: "BRL", monthlyValue: 6000, active: false, paymentDay: TODAY },
      { id: "j2", name: "Sem dia", company: "Acme", currency: "BRL", monthlyValue: 6000, active: true, paymentDay: null },
    ];
    const service = new TrackingJobPaymentsService(makeJobs(jobs), makePayments(), makeFx(null), makeAudit());

    const pending = await service.pending("user-1");

    expect(pending).toEqual([]);
  });
});

describe("TrackingJobPaymentsService.confirm", () => {
  it("stores the BRL amount directly for a BRL job, with no exchange rate", async () => {
    const job = { id: "j1", userId: "user-1", currency: "BRL", name: "Dev Backend" };
    const payments = makePayments();
    const fx = makeFx(null);
    const service = new TrackingJobPaymentsService(makeJobs([], { j1: job }), payments, fx, makeAudit());

    const result = await service.confirm("user-1", "j1", { amount: 6000 });

    expect(payments.upsert).toHaveBeenCalledWith(expect.objectContaining({ amount: 6000, currency: "BRL", exchangeRate: null, amountBRL: 6000 }));
    expect(result.jobName).toBe("Dev Backend");
    expect(fx.getUsdToBrlRate).not.toHaveBeenCalled();
  });

  it("converts using the live USD/BRL rate for a USD job", async () => {
    const job = { id: "j1", userId: "user-1", currency: "USD", name: "Freela EUA" };
    const payments = makePayments();
    const service = new TrackingJobPaymentsService(makeJobs([], { j1: job }), payments, makeFx(5), makeAudit());

    await service.confirm("user-1", "j1", { amount: 1000 });

    expect(payments.upsert).toHaveBeenCalledWith(expect.objectContaining({ amount: 1000, currency: "USD", exchangeRate: 5, amountBRL: 5000 }));
  });

  it("throws ServiceUnavailableException for a USD job when no exchange rate is available", async () => {
    const job = { id: "j1", userId: "user-1", currency: "USD", name: "Freela EUA" };
    const service = new TrackingJobPaymentsService(makeJobs([], { j1: job }), makePayments(), makeFx(null), makeAudit());

    await expect(service.confirm("user-1", "j1", { amount: 1000 })).rejects.toThrow(ServiceUnavailableException);
  });

  it("throws NotFoundException for a job that doesn't exist", async () => {
    const service = new TrackingJobPaymentsService(makeJobs([], {}), makePayments(), makeFx(null), makeAudit());

    await expect(service.confirm("user-1", "missing", { amount: 100 })).rejects.toThrow(NotFoundException);
  });

  it("throws ForbiddenException for a job owned by another user", async () => {
    const job = { id: "j1", userId: "other-user", currency: "BRL", name: "Dev Backend" };
    const service = new TrackingJobPaymentsService(makeJobs([], { j1: job }), makePayments(), makeFx(null), makeAudit());

    await expect(service.confirm("user-1", "j1", { amount: 100 })).rejects.toThrow(ForbiddenException);
  });

  it("logs an audit entry with before/after amounts", async () => {
    const job = { id: "j1", userId: "user-1", currency: "BRL", name: "Dev Backend" };
    const audit = makeAudit();
    const service = new TrackingJobPaymentsService(makeJobs([], { j1: job }), makePayments(), makeFx(null), audit);

    await service.confirm("user-1", "j1", { amount: 6000 });

    expect(audit.log).toHaveBeenCalledWith("user-1", "TrackingJobPayment", "payment-1", "CREATE", null, { amount: 6000, amountBRL: 6000 });
  });
});
