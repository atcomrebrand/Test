export interface SessionPauseInterval {
  pausedAt: string;
  resumedAt: string | null;
}

export interface SessionTimeInput {
  checkIn: string;
  checkOut: string | null;
  pauses: SessionPauseInterval[];
  asOf: Date;
}

export interface SessionTimeResult {
  grossSeconds: number;
  pauseSeconds: number;
  netSeconds: number;
}

/**
 * Mirrors the backend's session-time-calculator.ts formula exactly (gross = end-checkIn, pause =
 * sum of pause intervals, net = gross-pause) so the live ticking display and the persisted session
 * summary always agree. `asOf` stands in for "now" during an ongoing session — pass a fixed value
 * for a completed one.
 */
export function computeSessionTime(input: SessionTimeInput): SessionTimeResult {
  const checkIn = new Date(input.checkIn);
  const end = input.checkOut ? new Date(input.checkOut) : input.asOf;

  const grossSeconds = Math.max(0, Math.round((end.getTime() - checkIn.getTime()) / 1000));

  const pauseSeconds = input.pauses.reduce((total, pause) => {
    const pausedAt = new Date(pause.pausedAt);
    const pauseEnd = pause.resumedAt ? new Date(pause.resumedAt) : end;
    return total + Math.max(0, Math.round((pauseEnd.getTime() - pausedAt.getTime()) / 1000));
  }, 0);

  const netSeconds = Math.max(0, grossSeconds - pauseSeconds);

  return { grossSeconds, pauseSeconds, netSeconds };
}

export function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((n) => n.toString().padStart(2, "0")).join(":");
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function isSameLocalMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
