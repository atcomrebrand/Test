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
 */
export function computeSessionTime(input: SessionTimeInput): SessionTimeResult {
  const { checkIn, checkOut, pauses, asOf = new Date() } = input;
  const end = checkOut ?? asOf;

  if (end.getTime() < checkIn.getTime()) {
    throw new Error("Check-out não pode ser antes do check-in.");
  }

  const grossSeconds = Math.round((end.getTime() - checkIn.getTime()) / 1000);

  const pauseSeconds = pauses.reduce((total, pause) => {
    const pauseEnd = pause.resumedAt ?? end;
    const seconds = Math.max(0, Math.round((pauseEnd.getTime() - pause.pausedAt.getTime()) / 1000));
    return total + seconds;
  }, 0);

  const netSeconds = Math.max(0, grossSeconds - pauseSeconds);

  return { grossSeconds, pauseSeconds, netSeconds };
}
