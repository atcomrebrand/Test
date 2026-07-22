import { TrackingLiveTickerService } from "./tracking-live-ticker.service";
import { TrackingSessionRepository } from "../domain/tracking-session.repository";
import { PushService } from "../../push/push.service";

function makeSessions(sessions: unknown[] = []): TrackingSessionRepository {
  return { findAllActive: jest.fn().mockResolvedValue(sessions) } as unknown as TrackingSessionRepository;
}

function makePush(): PushService {
  return { notifyUser: jest.fn().mockResolvedValue(undefined) } as unknown as PushService;
}

const RUNNING_SESSION = {
  id: "s1",
  userId: "user-1",
  status: "RUNNING",
  checkIn: new Date(Date.now() - 90 * 60 * 1000),
  pauses: [],
  job: { company: "Acme Corp" },
};

describe("TrackingLiveTickerService.tick", () => {
  it("pushes an update with a fixed tag showing elapsed net time for a RUNNING session", async () => {
    const push = makePush();
    const service = new TrackingLiveTickerService(makeSessions([RUNNING_SESSION]), push);

    await service.tick();

    expect(push.notifyUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        title: expect.stringContaining("Acme Corp"),
        body: expect.stringContaining("1h30"),
        tag: "tracking-live-session",
      }),
    );
  });

  it("labels a PAUSED session as such instead of 'Trabalhando'", async () => {
    const push = makePush();
    const session = { ...RUNNING_SESSION, status: "PAUSED" };
    const service = new TrackingLiveTickerService(makeSessions([session]), push);

    await service.tick();

    expect(push.notifyUser).toHaveBeenCalledWith("user-1", expect.objectContaining({ title: expect.stringContaining("Pausado") }));
  });

  it("does nothing when there's no active session", async () => {
    const push = makePush();
    const service = new TrackingLiveTickerService(makeSessions([]), push);

    await service.tick();

    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it("one session's push failure doesn't stop the rest", async () => {
    const push = makePush();
    (push.notifyUser as jest.Mock).mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(undefined);
    const sessions = [
      { ...RUNNING_SESSION, id: "s1", userId: "user-1" },
      { ...RUNNING_SESSION, id: "s2", userId: "user-2" },
    ];
    const service = new TrackingLiveTickerService(makeSessions(sessions), push);

    await service.tick();

    expect(push.notifyUser).toHaveBeenCalledTimes(2);
  });
});
