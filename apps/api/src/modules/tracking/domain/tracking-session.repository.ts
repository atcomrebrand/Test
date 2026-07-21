import { TrackingJob, TrackingSession, TrackingSessionPause, TrackingSessionStatus } from "@prisma/client";

export type TrackingSessionWithPauses = TrackingSession & { pauses: TrackingSessionPause[]; job: TrackingJob };

export interface CreateTrackingSessionData {
  userId: string;
  jobId: string;
  checkIn: Date;
  notes?: string;
}

export interface CreateCompletedSessionData {
  userId: string;
  jobId: string;
  checkIn: Date;
  checkOut: Date;
  notes?: string;
}

export abstract class TrackingSessionRepository {
  /** The single RUNNING/PAUSED session for a user, if any — enforced app-side, not by a DB constraint. */
  abstract findActiveByUser(userId: string): Promise<TrackingSessionWithPauses | null>;
  abstract findById(id: string): Promise<TrackingSessionWithPauses | null>;
  abstract create(data: CreateTrackingSessionData): Promise<TrackingSessionWithPauses>;
  /** For "sessão retroativa" — created already COMPLETED, checkIn/checkOut both given up front, no
   *  pauses. Bypasses the timer state machine entirely (never touches the single-active-session rule). */
  abstract createCompleted(data: CreateCompletedSessionData): Promise<TrackingSessionWithPauses>;
  abstract addPause(sessionId: string, pausedAt: Date): Promise<void>;
  /** Sets `resumedAt` on the most recent still-open pause row for this session. */
  abstract resumeLatestPause(sessionId: string, resumedAt: Date): Promise<void>;
  abstract updateStatus(sessionId: string, status: TrackingSessionStatus): Promise<void>;
  abstract finish(sessionId: string, checkOut: Date, notes?: string): Promise<TrackingSessionWithPauses>;
  abstract updateManual(sessionId: string, data: { checkIn?: Date; checkOut?: Date; notes?: string }): Promise<TrackingSessionWithPauses>;
  abstract findAllByUser(userId: string, range?: { from: Date; to: Date }): Promise<TrackingSessionWithPauses[]>;
  /** For the "forgot to check out" cron sweep — RUNNING/PAUSED sessions started before `cutoff`. */
  abstract findRunningOlderThan(cutoff: Date): Promise<TrackingSessionWithPauses[]>;
  abstract delete(id: string): Promise<void>;
}
