import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { TrackingSessionsService } from "./tracking-sessions.service";
import { TrackingSessionRepository, TrackingSessionWithPauses } from "../domain/tracking-session.repository";
import { TrackingJobRepository } from "../domain/tracking-job.repository";
import { TrackingAuditService } from "./tracking-audit.service";
import { TrackingFxService } from "./tracking-fx.service";

const JOB = {
  id: "job-1",
  userId: "user-1",
  name: "Empresa X",
  company: "Empresa X",
  client: null,
  monthlyValue: 4000 as any,
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
    addPause: jest.fn().mockResolvedValue(undefined),
    resumeLatestPause: jest.fn().mockResolvedValue(undefined),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    finish: jest.fn(),
    updateManual: jest.fn(),
    findAllByUser: jest.fn().mockResolvedValue([]),
    findRunningOlderThan: jest.fn().mockResolvedValue([]),
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
