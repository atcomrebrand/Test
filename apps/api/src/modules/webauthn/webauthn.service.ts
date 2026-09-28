import { randomUUID } from "crypto";
import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { PrismaService } from "../../prisma/prisma.service";
import { RegistrationVerifyDto, LoginVerifyDto } from "./dto/webauthn.dto";

const CHALLENGE_TTL_MS = 2 * 60 * 1000;
const CLIENT_TIMEOUT_MS = 60 * 1000;

interface PendingChallenge {
  challenge: string;
  expiresAt: number;
}

/**
 * Face ID/Touch ID login via WebAuthn passkeys. Registration (binding a device's platform
 * authenticator to the account) requires being already logged in — it's a Settings action, not a
 * substitute for the password. Login is usernameless/discoverable: the device itself offers up
 * whichever resident credential it has for this site (no email typed first), which is how a
 * "just Face ID, nothing else" login button works — the server identifies the user afterwards by
 * looking up the credential ID the authenticator reports.
 *
 * Requires a secure context (HTTPS or localhost) and RP_ID matching the exact hostname actually
 * served — both are hard WebAuthn/browser requirements, not something this code can relax.
 */
@Injectable()
export class WebAuthnService {
  private readonly logger = new Logger(WebAuthnService.name);
  private readonly rpID = process.env.RP_ID ?? "localhost";
  private readonly rpName = process.env.RP_NAME ?? "Ferramentas do Mauro";
  private readonly rpOrigin = process.env.RP_ORIGIN ?? "http://localhost:5173";

  /** One in-flight registration challenge per user; login challenges are keyed by a random
   *  attemptId since the user isn't known yet at that point (discoverable-credential flow). */
  private readonly registrationChallenges = new Map<string, PendingChallenge>();
  private readonly loginChallenges = new Map<string, PendingChallenge>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async getRegistrationOptions(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const existing = await this.prisma.webAuthnCredential.findMany({ where: { userId } });

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userName: user.email,
      userDisplayName: user.name,
      userID: new TextEncoder().encode(user.id),
      timeout: CLIENT_TIMEOUT_MS,
      attestationType: "none",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
        authenticatorAttachment: "platform",
      },
      excludeCredentials: existing.map((c) => ({ id: c.credentialId, transports: c.transports as any })),
    });

    this.pruneExpired(this.registrationChallenges);
    this.registrationChallenges.set(userId, { challenge: options.challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS });

    return options;
  }

  async verifyRegistration(userId: string, dto: RegistrationVerifyDto) {
    const pending = this.registrationChallenges.get(userId);
    if (!pending || pending.expiresAt < Date.now()) {
      throw new BadRequestException("Sessão de cadastro expirada, tente novamente.");
    }

    const verification = await verifyRegistrationResponse({
      response: dto.response,
      expectedChallenge: pending.challenge,
      expectedOrigin: this.rpOrigin,
      expectedRPID: this.rpID,
    });

    this.registrationChallenges.delete(userId);

    if (!verification.verified || !verification.registrationInfo) {
      throw new BadRequestException("Não foi possível verificar o Face ID/Touch ID.");
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

    await this.prisma.webAuthnCredential.create({
      data: {
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports ?? [],
        name: dto.deviceName,
      },
    });

    return { registered: true };
  }

  async listCredentials(userId: string) {
    const credentials = await this.prisma.webAuthnCredential.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, deviceType: true, backedUp: true, name: true, createdAt: true },
    });
    return credentials;
  }

  async removeCredential(userId: string, id: string) {
    await this.prisma.webAuthnCredential.deleteMany({ where: { id, userId } });
    return { id };
  }

  /** Usernameless: no allowCredentials, so the platform authenticator itself decides which of its
   *  resident credentials (if any) to offer for this site. */
  async getLoginOptions() {
    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      timeout: CLIENT_TIMEOUT_MS,
      userVerification: "required",
    });

    const attemptId = randomUUID();
    this.pruneExpired(this.loginChallenges);
    this.loginChallenges.set(attemptId, { challenge: options.challenge, expiresAt: Date.now() + CHALLENGE_TTL_MS });

    return { attemptId, options };
  }

  async verifyLogin(dto: LoginVerifyDto) {
    const pending = this.loginChallenges.get(dto.attemptId);
    if (!pending || pending.expiresAt < Date.now()) {
      throw new UnauthorizedException("Sessão de login expirada, tente novamente.");
    }
    this.loginChallenges.delete(dto.attemptId);

    const stored = await this.prisma.webAuthnCredential.findUnique({ where: { credentialId: dto.response.id } });
    if (!stored) {
      throw new UnauthorizedException("Credencial não reconhecida neste servidor.");
    }

    const verification = await verifyAuthenticationResponse({
      response: dto.response,
      expectedChallenge: pending.challenge,
      expectedOrigin: this.rpOrigin,
      expectedRPID: this.rpID,
      requireUserVerification: true,
      credential: {
        id: stored.credentialId,
        publicKey: new Uint8Array(stored.publicKey),
        counter: stored.counter,
        transports: stored.transports as any,
      },
    });

    if (!verification.verified) {
      throw new UnauthorizedException("Não foi possível verificar o Face ID/Touch ID.");
    }

    await this.prisma.webAuthnCredential
      .update({ where: { id: stored.id }, data: { counter: verification.authenticationInfo.newCounter } })
      .catch((err) => this.logger.warn(`Falha ao atualizar contador da credencial ${stored.id}: ${(err as Error).message}`));

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: stored.userId } });

    return {
      token: this.jwt.sign({ sub: user.id, email: user.email }),
      user: { id: user.id, name: user.name, email: user.email },
    };
  }

  private pruneExpired(map: Map<string, PendingChallenge>) {
    const now = Date.now();
    for (const [key, value] of map) {
      if (value.expiresAt < now) map.delete(key);
    }
  }
}
