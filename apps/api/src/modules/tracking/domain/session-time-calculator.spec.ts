import { computeSessionTime } from "./session-time-calculator";

const H = 3600;

describe("computeSessionTime", () => {
  it("computes gross/pause/net for a completed session with no pauses", () => {
    const checkIn = new Date("2026-07-21T09:00:00Z");
    const checkOut = new Date("2026-07-21T17:00:00Z");

    const result = computeSessionTime({ checkIn, checkOut, pauses: [] });

    expect(result.grossSeconds).toBe(8 * H);
    expect(result.pauseSeconds).toBe(0);
    expect(result.netSeconds).toBe(8 * H);
  });

  it("subtracts a single completed pause from the gross time", () => {
    const checkIn = new Date("2026-07-21T09:00:00Z");
    const checkOut = new Date("2026-07-21T17:00:00Z");
    const pauses = [{ pausedAt: new Date("2026-07-21T12:00:00Z"), resumedAt: new Date("2026-07-21T13:00:00Z") }];

    const result = computeSessionTime({ checkIn, checkOut, pauses });

    expect(result.grossSeconds).toBe(8 * H);
    expect(result.pauseSeconds).toBe(1 * H);
    expect(result.netSeconds).toBe(7 * H);
  });

  it("sums multiple pauses", () => {
    const checkIn = new Date("2026-07-21T09:00:00Z");
    const checkOut = new Date("2026-07-21T18:00:00Z");
    const pauses = [
      { pausedAt: new Date("2026-07-21T11:00:00Z"), resumedAt: new Date("2026-07-21T11:30:00Z") },
      { pausedAt: new Date("2026-07-21T15:00:00Z"), resumedAt: new Date("2026-07-21T15:15:00Z") },
    ];

    const result = computeSessionTime({ checkIn, checkOut, pauses });

    expect(result.pauseSeconds).toBe(45 * 60);
    expect(result.netSeconds).toBe(9 * H - 45 * 60);
  });

  it("treats an open pause (resumedAt null) as extending to the session end", () => {
    const checkIn = new Date("2026-07-21T09:00:00Z");
    const checkOut = new Date("2026-07-21T13:00:00Z");
    const pauses = [{ pausedAt: new Date("2026-07-21T12:00:00Z"), resumedAt: null }];

    const result = computeSessionTime({ checkIn, checkOut, pauses });

    expect(result.pauseSeconds).toBe(1 * H);
    expect(result.netSeconds).toBe(3 * H);
  });

  it("computes a live/ongoing session (checkOut null) using asOf", () => {
    const checkIn = new Date("2026-07-21T09:00:00Z");
    const asOf = new Date("2026-07-21T09:30:00Z");

    const result = computeSessionTime({ checkIn, checkOut: null, pauses: [], asOf });

    expect(result.grossSeconds).toBe(30 * 60);
    expect(result.netSeconds).toBe(30 * 60);
  });

  it("an ongoing pause on a live session extends to asOf, not to a fixed end", () => {
    const checkIn = new Date("2026-07-21T09:00:00Z");
    const asOf = new Date("2026-07-21T10:00:00Z");
    const pauses = [{ pausedAt: new Date("2026-07-21T09:30:00Z"), resumedAt: null }];

    const result = computeSessionTime({ checkIn, checkOut: null, pauses, asOf });

    expect(result.grossSeconds).toBe(1 * H);
    expect(result.pauseSeconds).toBe(30 * 60);
    expect(result.netSeconds).toBe(30 * 60);
  });

  it("clamps to zero instead of throwing when checkOut is before checkIn", () => {
    const checkIn = new Date("2026-07-21T09:00:00Z");
    const checkOut = new Date("2026-07-21T08:00:00Z");

    const result = computeSessionTime({ checkIn, checkOut, pauses: [] });

    expect(result.grossSeconds).toBe(0);
    expect(result.pauseSeconds).toBe(0);
    expect(result.netSeconds).toBe(0);
  });

  it("never returns a negative netSeconds even if pauses somehow exceed gross time", () => {
    const checkIn = new Date("2026-07-21T09:00:00Z");
    const checkOut = new Date("2026-07-21T09:10:00Z");
    const pauses = [{ pausedAt: new Date("2026-07-21T09:00:00Z"), resumedAt: new Date("2026-07-21T09:20:00Z") }];

    const result = computeSessionTime({ checkIn, checkOut, pauses });

    expect(result.netSeconds).toBe(0);
  });
});
