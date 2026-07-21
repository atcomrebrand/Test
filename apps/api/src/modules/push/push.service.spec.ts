import * as webpush from "web-push";
import { PushService } from "./push.service";
import { PrismaService } from "../../prisma/prisma.service";

jest.mock("web-push", () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    pushSubscription: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides,
    },
  } as unknown as PrismaService;
}

describe("PushService", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it("getPublicKey returns null when VAPID keys aren't configured, so the frontend can hide the option", () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    const service = new PushService(makePrisma());

    expect(service.getPublicKey()).toBeNull();
  });

  it("getPublicKey returns the configured key and registers it with web-push", () => {
    process.env.VAPID_PUBLIC_KEY = "pub-key";
    process.env.VAPID_PRIVATE_KEY = "priv-key";
    const service = new PushService(makePrisma());

    expect(service.getPublicKey()).toBe("pub-key");
    expect(webpush.setVapidDetails).toHaveBeenCalledWith(expect.any(String), "pub-key", "priv-key");
  });

  it("notifyUser is a silent no-op when push isn't configured, never touching the DB or web-push", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    const prisma = makePrisma();
    const service = new PushService(prisma);

    await service.notifyUser("user-1", { title: "t", body: "b" });

    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("notifyUser sends to every subscription and prunes a 410 Gone one without failing the others", async () => {
    process.env.VAPID_PUBLIC_KEY = "pub-key";
    process.env.VAPID_PRIVATE_KEY = "priv-key";
    const subs = [
      { id: "s1", endpoint: "https://push/1", p256dh: "p1", auth: "a1" },
      { id: "s2", endpoint: "https://push/2", p256dh: "p2", auth: "a2" },
    ];
    const prisma = makePrisma({ findMany: jest.fn().mockResolvedValue(subs) });
    (webpush.sendNotification as jest.Mock)
      .mockRejectedValueOnce(Object.assign(new Error("Gone"), { statusCode: 410 }))
      .mockResolvedValueOnce(undefined);
    const service = new PushService(prisma);

    await service.notifyUser("user-1", { title: "t", body: "b" });

    expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });
});
