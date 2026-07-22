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

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Turns a single date + start/end time pair into checkIn/checkOut ISO timestamps, automatically
 * rolling the checkout onto the next calendar day when the end time is earlier than the start time
 * — the only sane reading of "entrada 16:30, saída 00:00" (a shift that crosses midnight), since the
 * form only has one date field. Without this, that same-looking input silently produced a checkOut
 * before checkIn, which the backend now rejects outright instead of persisting.
 */
export function buildSessionTimestamps(date: string, startTime: string, endTime: string) {
  const overnight = endTime < startTime;
  const checkIn = new Date(`${date}T${startTime}:00`).toISOString();
  const checkOut = new Date(`${overnight ? addDays(date, 1) : date}T${endTime}:00`).toISOString();
  return { checkIn, checkOut, overnight };
}
