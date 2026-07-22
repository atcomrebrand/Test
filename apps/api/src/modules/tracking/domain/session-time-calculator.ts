export interface SessionPauseInterval {
  pausedAt: Date;
  resumedAt: Date | null;
}

export interface SessionTimeInput {
  checkIn: Date;
  checkOut: Date | null;
  pauses: SessionPauseInterval[];
  /** Defaults to `new Date()` — pass a fixed value in tests (and for a live/ongoing tick) for determinism. */
  asOf?: Date;
}

export interface SessionTimeResult {
  grossSeconds: number;
  pauseSeconds: number;
  netSeconds: number;
}

/**
 * Single source of truth for "how long was this session" — used identically by the live frontend
 * ticker and the persisted session totals at finish-time, so a running session and its saved
 * summary never disagree. Never an accumulated counter: always derived from real timestamps
 * (checkIn/checkOut/pauses), which survive reloads, browser closes and device switches untouched.
 *
 * Never throws: an end before checkIn clamps to zero instead. Validating "checkOut must be after
 * checkIn" belongs to the write path (TrackingSessionsService), not here — every read path
 * (dashboard/calendar/stats/relatórios/exportação/sessões) computes this per-session inside a
 * plain loop with no per-item error isolation, so one bad legacy row throwing here would take
 * down the whole batch instead of just that session.
 */
export function computeSessionTime(input: SessionTimeInput): SessionTimeResult {
  const { checkIn, checkOut, pauses, asOf = new Date() } = input;
  const end = checkOut ?? asOf;

  const grossSeconds = Math.max(0, Math.round((end.getTime() - checkIn.getTime()) / 1000));

  const pauseSeconds = pauses.reduce((total, pause) => {
    const pauseEnd = pause.resumedAt ?? end;
    const seconds = Math.max(0, Math.round((pauseEnd.getTime() - pause.pausedAt.getTime()) / 1000));
    return total + seconds;
  }, 0);

  const netSeconds = Math.max(0, grossSeconds - pauseSeconds);

  return { grossSeconds, pauseSeconds, netSeconds };
}
