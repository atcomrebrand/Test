import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { TrackingSessionRepository, TrackingSessionWithPauses } from "../domain/tracking-session.repository";
import { TrackingJobRepository } from "../domain/tracking-job.repository";
import { computeSessionTime } from "../domain/session-time-calculator";
import { estimateJobHourlyRate } from "../domain/job-hourly-estimate";
import { convertToBRL } from "../domain/currency-converter";
import { TrackingAuditService } from "./tracking-audit.service";
import { TrackingFxService } from "./tracking-fx.service";
import { ManualEditSessionDto, StartSessionDto } from "./dto/tracking-session.dto";

/** Sessions running longer than this are flagged as "esqueceu de finalizar" candidates — both to
 *  the user in real time (frontend confirm dialog) and via the notification cron sweep. */
export const LONG_SESSION_HOURS = 16;

@Injectable()
export class TrackingSessionsService {
  constructor(
    private readonly sessions: TrackingSessionRepository,
    private readonly jobs: TrackingJobRepository,
    private readonly audit: TrackingAuditService,
    private readonly fx: TrackingFxService,
  ) {}

  async getActive(userId: string) {
    const session = await this.sessions.findActiveByUser(userId);
    return session ? this.present(session) : null;
  }

  /** Only one RUNNING/PAUSED session may exist per user at a time — checked here, not in the DB,
   *  matching the ownership-check convention used elsewhere in this codebase. */
  async start(userId: string, dto: StartSessionDto) {
    const active = await this.sessions.findActiveByUser(userId);
    if (active) throw new ConflictException("Já existe uma sessão em andamento. Finalize-a antes de iniciar outra.");

    const job = await this.getOwnedJob(userId, dto.jobId);
    const session = await this.sessions.create({ userId, jobId: job.id, checkIn: new Date(), notes: dto.notes });
    await this.audit.log(userId, "TrackingSession", session.id, "CHECK_IN", null, { checkIn: session.checkIn });
    return await this.present(session);
  }

  async pause(userId: string, sessionId: string) {
    const session = await this.getOwned(userId, sessionId);
    if (session.status !== "RUNNING") throw new ConflictException("Sessão não está em andamento.");
    await this.sessions.addPause(sessionId, new Date());
    await this.sessions.updateStatus(sessionId, "PAUSED");
    return this.present(await this.getOwned(userId, sessionId));
  }

  async resume(userId: string, sessionId: string) {
    const session = await this.getOwned(userId, sessionId);
    if (session.status !== "PAUSED") throw new ConflictException("Sessão não está pausada.");
    await this.sessions.resumeLatestPause(sessionId, new Date());
    await this.sessions.updateStatus(sessionId, "RUNNING");
    return this.present(await this.getOwned(userId, sessionId));
  }

  async finish(userId: string, sessionId: string, notes?: string) {
    const session = await this.getOwned(userId, sessionId);
    if (session.status === "COMPLETED") throw new ConflictException("Sessão já finalizada.");

    const checkOut = new Date();
    // An open pause left running (user hit "Finalizar" while paused) is closed at the same instant.
    if (session.status === "PAUSED") {
      await this.sessions.resumeLatestPause(sessionId, checkOut);
    }

    const finished = await this.sessions.finish(sessionId, checkOut, notes);
    await this.audit.log(userId, "TrackingSession", sessionId, "CHECK_OUT", { checkOut: null }, { checkOut });
    return this.present(finished);
  }

  async updateManual(userId: string, sessionId: string, dto: ManualEditSessionDto) {
    const before = await this.getOwned(userId, sessionId);
    const data: { checkIn?: Date; checkOut?: Date; notes?: string } = {};
    if (dto.checkIn) data.checkIn = new Date(dto.checkIn);
    if (dto.checkOut) data.checkOut = new Date(dto.checkOut);
    if (dto.notes !== undefined) data.notes = dto.notes;

    const after = await this.sessions.updateManual(sessionId, data);
    await this.audit.log(userId, "TrackingSession", sessionId, "MANUAL_EDIT", this.snapshot(before), this.snapshot(after));
    return this.present(after);
  }

  async findAll(userId: string, from?: string, to?: string) {
    const range = from && to ? { from: new Date(from), to: new Date(to) } : undefined;
    const sessions = await this.sessions.findAllByUser(userId, range);
    return Promise.all(sessions.map((s) => this.present(s)));
  }

  async remove(userId: string, sessionId: string) {
    const before = await this.getOwned(userId, sessionId);
    await this.sessions.delete(sessionId);
    await this.audit.log(userId, "TrackingSession", sessionId, "DELETE", this.snapshot(before), null);
    return { id: sessionId };
  }

  /** Adds the derived numbers (elapsed time, equivalent value) to a raw session row using the same
   *  computeSessionTime formula the frontend's live ticker uses, so client and server never disagree.
   *  When the job is USD-denominated, converts to BRL using today's rate first — everything downstream
   *  (dashboard, relatórios, o card do Modo Foco) always deals in BRL. */
  private async present(session: TrackingSessionWithPauses) {
    const time = computeSessionTime({
      checkIn: session.checkIn,
      checkOut: session.checkOut,
      pauses: session.pauses.map((p) => ({ pausedAt: p.pausedAt, resumedAt: p.resumedAt })),
    });

    const currency = session.job.currency ?? "BRL";
    const usdToBrlRate = currency === "USD" ? await this.fx.getUsdToBrlRate() : null;
    const monthlyValueBRL = convertToBRL(Number(session.job.monthlyValue), currency, usdToBrlRate);
    const hourlyRate =
      monthlyValueBRL !== null
        ? estimateJobHourlyRate({ monthlyValue: monthlyValueBRL, expectedHoursPerDay: session.job.expectedHoursPerDay, weekdays: session.job.weekdays })
        : 0;

    const isLongRunning = session.status !== "COMPLETED" && time.grossSeconds >= LONG_SESSION_HOURS * 3600;

    return {
      ...session,
      ...time,
      hourlyRate,
      equivalentValue: Math.round((time.netSeconds / 3600) * hourlyRate * 100) / 100,
      isLongRunning,
    };
  }

  private snapshot(session: TrackingSessionWithPauses) {
    return { checkIn: session.checkIn, checkOut: session.checkOut, notes: session.notes, status: session.status };
  }

  private async getOwned(userId: string, id: string) {
    const session = await this.sessions.findById(id);
    if (!session) throw new NotFoundException("Sessão não encontrada.");
    if (session.userId !== userId) throw new ForbiddenException();
    return session;
  }

  private async getOwnedJob(userId: string, jobId: string) {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new NotFoundException("Trabalho fixo não encontrado.");
    if (job.userId !== userId) throw new ForbiddenException();
    if (!job.active) throw new ConflictException("Trabalho fixo está inativo.");
    return job;
  }
}
