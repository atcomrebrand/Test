import { useEffect, useState } from "react";
import { TrackingSession } from "../types";
import { computeSessionTime } from "../lib/sessionTime";

export interface LiveElapsed {
  grossSeconds: number;
  pauseSeconds: number;
  netSeconds: number;
  equivalentValue: number;
}

/**
 * Ticks every second but never accumulates client-side — every tick recomputes straight from the
 * session's real timestamps (checkIn/checkOut/pauses), the same formula the backend uses. This is
 * what makes the timer survive a reload, closing the browser, or switching devices: whatever the
 * server currently says about checkIn/pauses is the only source of truth, `now` merely drives a
 * re-render.
 */
export function useLiveElapsed(session: TrackingSession | null | undefined): LiveElapsed | null {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!session || session.status === "COMPLETED") return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [session?.id, session?.status]);

  if (!session) return null;

  const time = computeSessionTime({
    checkIn: session.checkIn,
    checkOut: session.checkOut,
    pauses: session.pauses,
    asOf: now,
  });

  const equivalentValue = Math.round((time.netSeconds / 3600) * session.hourlyRate * 100) / 100;

  return { ...time, equivalentValue };
}
