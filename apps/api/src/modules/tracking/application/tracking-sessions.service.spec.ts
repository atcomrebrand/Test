import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { TrackingSessionsService } from "./tracking-sessions.service";
import { TrackingSessionRepository, TrackingSessionWithPauses } from "../domain/tracking-session.repository";
import { TrackingJobRepository } from "../domain/tracking-job.repository";
import { TrackingAuditService } from "./tracking-audit.service";
import { TrackingFxService } from "./tracking-fx.service";

const JOB = {
  id: "job-1",
  userId: "user-1",
  type: "FIXO" as const,
  name: "Empresa X",
  company: "Empresa X",
  client: null,
  monthlyValue: 4000 as any,
  totalAgreedValue: null as any,
  currency: "BRL" as const,
  expectedHoursPerDay: 8,
  startDate: new Date("2026-01-01"),
  endDate: null,
  paymentMethod: null,
  color: "#7C3AED",
  weekdays: [1, 2, 3, 4, 5],
  notes: null,
  active: true,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const FREELANCE_JOB = {
  ...JOB,
  id: "job-2",
  type: "FREELANCE" as const,
  name: "Landing page",
  company: "Cliente Y",
  client: "Cliente Y",
  monthlyValue: null as any,
  totalAgreedValue: 800 as any,
};

function makeSession(overrides: Partial<TrackingSessionWithPauses> = {}): TrackingSessionWithPauses {
  return {
    id: "session-1",
    userId: "user-1",
    jobId: "job-1",
    checkIn: new Date("2026-07-21T09:00:00Z"),
    checkOut: null,
    status: "RUNNING",
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    pauses: [],
    job: JOB as any,
    ...overrides,
  } as TrackingSessionWithPauses;
}

function makeRepos(session: TrackingSessionWithPauses | null = null) {
  const sessions: jest.Mocked<TrackingSessionRepository> = {
    findActiveByUser: jest.fn().mockResolvedValue(session),
    findById: jest.fn().mockResolvedValue(session),
    create: jest.fn(),
    createCompleted: jest.fn().mockImplementation((data) => Promise.resolve(makeSession({ ...data, status: "COMPLETED", pauses: [] }))),
    addPause: jest.fn().mockResolvedValue(undefined),
    resumeLatestPause: jest.fn().mockResolvedValue(undefined),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    finish: jest.fn(),
    updateManual: jest.fn(),
    findAllByUser: jest.fn().mockResolvedValue([]),
    findRunningOlderThan: jest.fn().mockResolvedValue([]),
    findCompletedByJobIds: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(undefined),
  } as any;

  const jobs: jest.Mocked<TrackingJobRepository> = {
    findAllByUser: jest.fn(),
    findById: jest.fn().mockResolvedValue(JOB),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  } as any;

  const audit = { log: jest.fn().mockResolvedValue(undefined) } as unknown as TrackingAuditService;
  const fx = { getUsdToBrlRate: jest.fn().mockResolvedValue(5) } as unknown as TrackingFxService;

  return { sessions, jobs, audit, fx };
}

describe("TrackingSessionsService.start", () => {
  it("throws ConflictException if the user already has an active session", async () => {
    const { sessions, jobs, audit, fx } = makeRepos(makeSession());
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    await expect(service.start("user-1", { jobId: "job-1" })).rejects.toThrow(ConflictException);
  });

  it("throws NotFoundException when the job doesn't exist", async () => {
    const { sessions, jobs, audit, fx } = makeRepos(null);
    jobs.findById.mockResolvedValue(null);
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    await expect(service.start("user-1", { jobId: "missing" })).rejects.toThrow(NotFoundException);
  });

  it("throws ForbiddenException when the job belongs to another user", async () => {
    const { sessions, jobs, audit, fx } = makeRepos(null);
    jobs.findById.mockResolvedValue({ ...JOB, userId: "someone-else" } as any);
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    await expect(service.start("user-1", { jobId: "job-1" })).rejects.toThrow(ForbiddenException);
  });

  it("throws ConflictException when the job is inactive", async () => {
    const { sessions, jobs, audit, fx } = makeRepos(null);
    jobs.findById.mockResolvedValue({ ...JOB, active: false } as any);
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    await expect(service.start("user-1", { jobId: "job-1" })).rejects.toThrow(ConflictException);
  });

  it("creates a session and logs a CHECK_IN audit entry", async () => {
    const created = makeSession();
    const { sessions, jobs, audit, fx } = makeRepos(null);
    sessions.create.mockResolvedValue(created);
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    const result = await service.start("user-1", { jobId: "job-1" });

    expect(sessions.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", jobId: "job-1" }));
    expect(audit.log).toHaveBeenCalledWith("user-1", "TrackingSession", "session-1", "CHECK_IN", null, expect.anything());
    expect(result.status).toBe("RUNNING");
  });
});

describe("TrackingSessionsService.pause/resume", () => {
  it("pause() throws if the session isn't RUNNING", async () => {
    const { sessions, jobs, audit, fx } = makeRepos(makeSession({ status: "PAUSED" }));
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    await expect(service.pause("user-1", "session-1")).rejects.toThrow(ConflictException);
  });

  it("pause() adds a pause row and flips status to PAUSED", async () => {
    const { sessions, jobs, audit, fx } = makeRepos(makeSession({ status: "RUNNING" }));
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    await service.pause("user-1", "session-1");

    expect(sessions.addPause).toHaveBeenCalledWith("session-1", expect.any(Date));
    expect(sessions.updateStatus).toHaveBeenCalledWith("session-1", "PAUSED");
  });

  it("resume() throws if the session isn't PAUSED", async () => {
    const { sessions, jobs, audit, fx } = makeRepos(makeSession({ status: "RUNNING" }));
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    await expect(service.resume("user-1", "session-1")).rejects.toThrow(ConflictException);
  });

  it("resume() closes the latest pause and flips status to RUNNING", async () => {
    const { sessions, jobs, audit, fx } = makeRepos(makeSession({ status: "PAUSED" }));
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    await service.resume("user-1", "session-1");

    expect(sessions.resumeLatestPause).toHaveBeenCalledWith("session-1", expect.any(Date));
    expect(sessions.updateStatus).toHaveBeenCalledWith("session-1", "RUNNING");
  });
});

describe("TrackingSessionsService.finish", () => {
  it("throws if the session is already COMPLETED", async () => {
    const { sessions, jobs, audit, fx } = makeRepos(makeSession({ status: "COMPLETED", checkOut: new Date() }));
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    await expect(service.finish("user-1", "session-1")).rejects.toThrow(ConflictException);
  });

  it("closes an open pause automatically when finishing a PAUSED session", async () => {
    const session = makeSession({ status: "PAUSED" });
    const { sessions, jobs, audit, fx } = makeRepos(session);
    sessions.finish.mockResolvedValue(makeSession({ status: "COMPLETED", checkOut: new Date() }));
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    await service.finish("user-1", "session-1");

    expect(sessions.resumeLatestPause).toHaveBeenCalled();
    expect(sessions.finish).toHaveBeenCalledWith("session-1", expect.any(Date), undefined);
  });

  it("computes equivalentValue from netSeconds and the job's estimated hourly rate", async () => {
    // 4000/month, Mon-Fri, 8h/day -> hourlyRate ~= 23.02; an 8h completed session should be ~= 184.16
    const checkIn = new Date("2026-07-21T09:00:00Z");
    const checkOut = new Date("2026-07-21T17:00:00Z");
    const running = makeSession({ status: "RUNNING", checkIn });
    const completed = makeSession({ status: "COMPLETED", checkIn, checkOut });
    const { sessions, jobs, audit, fx } = makeRepos(running);
    sessions.finish.mockResolvedValue(completed);
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    const result = await service.finish("user-1", "session-1");

    expect(result.netSeconds).toBe(8 * 3600);
    expect(result.equivalentValue).toBeCloseTo(184.16, 0);
  });
});

describe("TrackingSessionsService.getActive", () => {
  it("returns null when there's no active session", async () => {
    const { sessions, jobs, audit, fx } = makeRepos(null);
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    expect(await service.getActive("user-1")).toBeNull();
  });

  it("flags isLongRunning once gross elapsed time passes the threshold", async () => {
    const checkIn = new Date(Date.now() - 17 * 3600 * 1000);
    const { sessions, jobs, audit, fx } = makeRepos(makeSession({ status: "RUNNING", checkIn }));
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    const result = await service.getActive("user-1");

    expect(result?.isLongRunning).toBe(true);
  });
});

describe("TrackingSessionsService.createManual", () => {
  it("creates an already-COMPLETED session directly, without touching the active-session check", async () => {
    const { sessions, jobs, audit, fx } = makeRepos(null);
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    const checkIn = "2026-07-18T09:00:00.000Z";
    const checkOut = "2026-07-18T17:00:00.000Z";
    const result = await service.createManual("user-1", { jobId: "job-1", checkIn, checkOut, notes: "esqueci de cronometrar" });

    expect(sessions.createCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", jobId: "job-1", checkIn: new Date(checkIn), checkOut: new Date(checkOut) }),
    );
    expect(sessions.findActiveByUser).not.toHaveBeenCalled();
    expect(result.status).toBe("COMPLETED");
    expect(result.netSeconds).toBeCloseTo(8 * 3600, 0);
  });

  it("throws BadRequestException when checkOut is before or equal to checkIn", async () => {
    const { sessions, jobs, audit, fx } = makeRepos(null);
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    await expect(
      service.createManual("user-1", { jobId: "job-1", checkIn: "2026-07-18T17:00:00.000Z", checkOut: "2026-07-18T09:00:00.000Z" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws BadRequestException when checkOut is in the future", async () => {
    const { sessions, jobs, audit, fx } = makeRepos(null);
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);
    const future = new Date(Date.now() + 3600_000).toISOString();

    await expect(
      service.createManual("user-1", { jobId: "job-1", checkIn: new Date().toISOString(), checkOut: future }),
    ).rejects.toThrow(BadRequestException);
  });

  it("throws NotFoundException for a job that doesn't exist", async () => {
    const { sessions, jobs, audit, fx } = makeRepos(null);
    jobs.findById.mockResolvedValue(null);
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    await expect(
      service.createManual("user-1", { jobId: "missing", checkIn: "2026-07-18T09:00:00.000Z", checkOut: "2026-07-18T17:00:00.000Z" }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe("TrackingSessionsService.updateManual", () => {
  it("updates checkIn and checkOut on an already-COMPLETED session", async () => {
    const existing = makeSession({ status: "COMPLETED", checkIn: new Date("2026-07-20T13:00:00Z"), checkOut: new Date("2026-07-20T15:00:00Z") });
    const { sessions, jobs, audit, fx } = makeRepos(existing);
    sessions.updateManual.mockResolvedValue({ ...existing, checkOut: new Date("2026-07-20T18:00:00Z") });
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    const result = await service.updateManual("user-1", "session-1", { checkOut: "2026-07-20T18:00:00.000Z" });

    expect(sessions.updateManual).toHaveBeenCalledWith("session-1", { checkOut: new Date("2026-07-20T18:00:00Z") });
    expect(result.netSeconds).toBeCloseTo(5 * 3600, 0);
  });

  it("throws BadRequestException instead of persisting when the new checkOut would be before checkIn", async () => {
    const existing = makeSession({ status: "COMPLETED", checkIn: new Date("2026-07-20T16:30:00Z"), checkOut: new Date("2026-07-20T20:00:00Z") });
    const { sessions, jobs, audit, fx } = makeRepos(existing);
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    // Regression: an overnight shift (16:30 -> 00:00 next day) entered against the same calendar
    // date used to slip past validation here (createManual already checked this, updateManual
    // didn't), writing checkOut < checkIn straight to the DB — which then crashed every batch read
    // (dashboard/calendar/stats/relatórios/exportação/sessões) the moment it tried to present() it.
    await expect(service.updateManual("user-1", "session-1", { checkOut: "2026-07-20T00:00:00.000Z" })).rejects.toThrow(BadRequestException);
    expect(sessions.updateManual).not.toHaveBeenCalled();
  });

  it("throws BadRequestException when only checkIn is edited past the session's existing checkOut", async () => {
    const existing = makeSession({ status: "COMPLETED", checkIn: new Date("2026-07-20T09:00:00Z"), checkOut: new Date("2026-07-20T17:00:00Z") });
    const { sessions, jobs, audit, fx } = makeRepos(existing);
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    await expect(service.updateManual("user-1", "session-1", { checkIn: "2026-07-20T18:00:00.000Z" })).rejects.toThrow(BadRequestException);
    expect(sessions.updateManual).not.toHaveBeenCalled();
  });

  it("throws BadRequestException when the resulting checkOut would be in the future", async () => {
    const existing = makeSession({ status: "COMPLETED", checkIn: new Date("2026-07-20T09:00:00Z"), checkOut: new Date("2026-07-20T17:00:00Z") });
    const { sessions, jobs, audit, fx } = makeRepos(existing);
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);
    const future = new Date(Date.now() + 3600_000).toISOString();

    await expect(service.updateManual("user-1", "session-1", { checkOut: future })).rejects.toThrow(BadRequestException);
    expect(sessions.updateManual).not.toHaveBeenCalled();
  });

  it("allows editing only checkIn on a still-active (checkOut null) session, without checkOut validation", async () => {
    const existing = makeSession({ status: "RUNNING", checkIn: new Date("2026-07-20T09:00:00Z"), checkOut: null });
    const { sessions, jobs, audit, fx } = makeRepos(existing);
    sessions.updateManual.mockResolvedValue({ ...existing, checkIn: new Date("2026-07-20T08:30:00Z") });
    const service = new TrackingSessionsService(sessions, jobs, audit, fx);

    await service.updateManual("user-1", "session-1", { checkIn: "2026-07-20T08:30:00.000Z" });

    expect(sessions.updateManual).toHaveBeenCalledWith("session-1", { checkIn: new Date("2026-07-20T08:30:00Z") });
  });
});

describe("TrackingSessionsService.present (FREELANCE jobs)", () => {
  it("computes the hourly rate as totalAgreedValue ÷ this session's own live hours, when it's the only one so far", async () => {
    // 4h in, R$800 combinado -> R$200/h so far
    const checkIn = new Date(Date.now() - 4 * 3600 * 1000);
    const { sessions, jobs, audit, fx } = makeRepos(makeSession({ job: FREELANCE_JOB as any, jobId: "job-2", checkIn, status: "RUNNING" }));

    const service = new TrackingSessionsService(sessions, jobs, audit, fx);
    const result = await service.getActive("user-1");

    expect(sessions.findCompletedByJobIds).toHaveBeenCalledWith(["job-2"]);
    expect(result?.hourlyRate).toBeCloseTo(200, 0);
  });

  it("includes previously completed sessions of the same job when computing the rate", async () => {
    const checkIn = new Date(Date.now() - 4 * 3600 * 1000);
    const priorSession = makeSession({
      id: "session-prior",
      jobId: "job-2",
      job: FREELANCE_JOB as any,
      status: "COMPLETED",
      checkIn: new Date("2026-07-01T09:00:00Z"),
      checkOut: new Date("2026-07-01T13:00:00Z"), // 4h already logged
    });
    const { sessions, jobs, audit, fx } = makeRepos(makeSession({ job: FREELANCE_JOB as any, jobId: "job-2", checkIn, status: "RUNNING" }));
    sessions.findCompletedByJobIds.mockResolvedValue([priorSession]);

    const service = new TrackingSessionsService(sessions, jobs, audit, fx);
    const result = await service.getActive("user-1");

    // 4h prior + 4h now = 8h total -> R$800/8h = R$100/h
    expect(result?.hourlyRate).toBeCloseTo(100, 0);
  });

  it("returns hourlyRate 0 when no hours have been logged yet for the freelance job", async () => {
    const { sessions, jobs, audit, fx } = makeRepos(
      makeSession({ job: FREELANCE_JOB as any, jobId: "job-2", checkIn: new Date(), status: "RUNNING" }),
    );

    const service = new TrackingSessionsService(sessions, jobs, audit, fx);
    const result = await service.getActive("user-1");

    expect(result?.hourlyRate).toBe(0);
  });
});
