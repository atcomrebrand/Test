import { ForbiddenException, NotFoundException } from "@nestjs/common";
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

/**
 * O relógio fica PARADO no dia 15.
 *
 * O serviço lê `new Date()` por dentro, então estes testes dependiam do dia real em que rodassem —
 * e quebravam no dia 28 de cada mês, quando o "dia futuro" calculado como `TODAY === 28 ? 27 : ...`
 * caía no passado. Um teste que só falha um dia por mês é pior que um que sempre falha: ninguém
 * associa a quebra ao motivo. Fixando a data, "ontem" e "amanhã" passam a existir sempre.
 */
const NOW = new Date("2026-08-15T12:00:00");

beforeAll(() => {
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] }).setSystemTime(NOW);
});
afterAll(() => {
  jest.useRealTimers();
});

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
      expect.objectContaining({ jobId: "j1", jobName: "Dev Backend", referenceYear: YEAR, referenceMonth: MONTH, suggestedAmountBRL: 6000 }),
    ]);
  });

  it("excludes jobs whose paymentDay hasn't arrived yet this month", async () => {
    const futureDay = TODAY + 1;
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

  it("converts a USD job's monthlyValue to a suggested BRL amount using the live rate", async () => {
    const jobs = [{ id: "j1", name: "Freela EUA", company: "Acme Inc", currency: "USD", monthlyValue: 1000, active: true, paymentDay: TODAY }];
    const service = new TrackingJobPaymentsService(makeJobs(jobs), makePayments(), makeFx(5), makeAudit());

    const pending = await service.pending("user-1");

    expect(pending[0].suggestedAmountBRL).toBe(5000);
  });

  it("returns a null suggestedAmountBRL for a USD job when no exchange rate is available", async () => {
    const jobs = [{ id: "j1", name: "Freela EUA", company: "Acme Inc", currency: "USD", monthlyValue: 1000, active: true, paymentDay: TODAY }];
    const service = new TrackingJobPaymentsService(makeJobs(jobs), makePayments(), makeFx(null), makeAudit());

    const pending = await service.pending("user-1");

    expect(pending[0].suggestedAmountBRL).toBeNull();
  });
});

describe("TrackingJobPaymentsService.confirm", () => {
  it("stores the amount as BRL directly, with no exchange rate, for a BRL job", async () => {
    const job = { id: "j1", userId: "user-1", currency: "BRL", name: "Dev Backend" };
    const payments = makePayments();
    const fx = makeFx(null);
    const service = new TrackingJobPaymentsService(makeJobs([], { j1: job }), payments, fx, makeAudit());

    const result = await service.confirm("user-1", "j1", { amount: 6000 });

    expect(payments.upsert).toHaveBeenCalledWith(expect.objectContaining({ amount: 6000, currency: "BRL", exchangeRate: null, amountBRL: 6000 }));
    expect(result.jobName).toBe("Dev Backend");
    expect(fx.getUsdToBrlRate).not.toHaveBeenCalled();
  });

  it("also stores the amount as BRL directly for a USD job — the amount received is already in reais, no re-conversion", async () => {
    const job = { id: "j1", userId: "user-1", currency: "USD", name: "Freela EUA" };
    const payments = makePayments();
    const fx = makeFx(5);
    const service = new TrackingJobPaymentsService(makeJobs([], { j1: job }), payments, fx, makeAudit());

    await service.confirm("user-1", "j1", { amount: 5000 });

    expect(payments.upsert).toHaveBeenCalledWith(expect.objectContaining({ amount: 5000, currency: "BRL", exchangeRate: null, amountBRL: 5000 }));
    expect(fx.getUsdToBrlRate).not.toHaveBeenCalled();
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
