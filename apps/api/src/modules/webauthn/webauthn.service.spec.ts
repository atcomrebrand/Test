import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import * as simplewebauthn from "@simplewebauthn/server";
import { WebAuthnService } from "./webauthn.service";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";

jest.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    user: { findUniqueOrThrow: jest.fn() },
    webAuthnCredential: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn(),
      ...overrides,
    },
  } as unknown as PrismaService;
}

function makeJwt() {
  return { sign: jest.fn().mockReturnValue("signed-jwt") } as unknown as JwtService;
}

describe("WebAuthnService", () => {
  afterEach(() => jest.clearAllMocks());

  describe("registration", () => {
    it("verifyRegistration rejects when there's no matching pending challenge (never called getRegistrationOptions first)", async () => {
      const service = new WebAuthnService(makePrisma(), makeJwt());

      await expect(service.verifyRegistration("user-1", { response: {} as any })).rejects.toThrow(BadRequestException);
    });

    it("stores a new credential after a verified registration", async () => {
      (simplewebauthn.generateRegistrationOptions as jest.Mock).mockResolvedValue({ challenge: "chal-1" });
      (simplewebauthn.verifyRegistrationResponse as jest.Mock).mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: { id: "cred-1", publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ["internal"] },
          credentialDeviceType: "singleDevice",
          credentialBackedUp: false,
        },
      });
      const prisma = makePrisma({ create: jest.fn().mockResolvedValue({ id: "wc-1" }) });
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({ id: "user-1", email: "a@b.com", name: "A" });
      const service = new WebAuthnService(prisma, makeJwt());

      await service.getRegistrationOptions("user-1");
      const result = await service.verifyRegistration("user-1", { response: { id: "cred-1" } as any });

      expect(result).toEqual({ registered: true });
      expect(prisma.webAuthnCredential.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: "user-1", credentialId: "cred-1", counter: 0 }) }),
      );
    });

    it("rejects when verifyRegistrationResponse itself reports not verified", async () => {
      (simplewebauthn.generateRegistrationOptions as jest.Mock).mockResolvedValue({ challenge: "chal-1" });
      (simplewebauthn.verifyRegistrationResponse as jest.Mock).mockResolvedValue({ verified: false });
      const prisma = makePrisma();
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({ id: "user-1", email: "a@b.com", name: "A" });
      const service = new WebAuthnService(prisma, makeJwt());

      await service.getRegistrationOptions("user-1");

      await expect(service.verifyRegistration("user-1", { response: {} as any })).rejects.toThrow(BadRequestException);
    });
  });

  describe("login (usernameless)", () => {
    it("rejects an unknown credential id — no account registered it on this server", async () => {
      (simplewebauthn.generateAuthenticationOptions as jest.Mock).mockResolvedValue({ challenge: "chal-2" });
      const prisma = makePrisma({ findUnique: jest.fn().mockResolvedValue(null) });
      const service = new WebAuthnService(prisma, makeJwt());

      const { attemptId } = await service.getLoginOptions();

      await expect(service.verifyLogin({ attemptId, response: { id: "unknown-cred" } as any })).rejects.toThrow(UnauthorizedException);
    });

    it("rejects a login-verify call with an unknown/expired attemptId", async () => {
      const service = new WebAuthnService(makePrisma(), makeJwt());

      await expect(service.verifyLogin({ attemptId: "does-not-exist", response: { id: "x" } as any })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("signs a JWT and bumps the stored counter on a verified login", async () => {
      (simplewebauthn.generateAuthenticationOptions as jest.Mock).mockResolvedValue({ challenge: "chal-3" });
      (simplewebauthn.verifyAuthenticationResponse as jest.Mock).mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 7 },
      });
      const stored = { id: "wc-1", userId: "user-1", credentialId: "cred-1", publicKey: Buffer.from([1, 2, 3]), counter: 6, transports: [] };
      const prisma = makePrisma({ findUnique: jest.fn().mockResolvedValue(stored) });
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({ id: "user-1", email: "a@b.com", name: "A" });
      const jwt = makeJwt();
      const service = new WebAuthnService(prisma, jwt);

      const { attemptId } = await service.getLoginOptions();
      const result = await service.verifyLogin({ attemptId, response: { id: "cred-1" } as any });

      expect(result).toEqual({ token: "signed-jwt", user: { id: "user-1", name: "A", email: "a@b.com" } });
      expect(prisma.webAuthnCredential.update).toHaveBeenCalledWith({ where: { id: "wc-1" }, data: { counter: 7 } });
      expect(jwt.sign).toHaveBeenCalledWith({ sub: "user-1", email: "a@b.com" });
    });
  });
});
