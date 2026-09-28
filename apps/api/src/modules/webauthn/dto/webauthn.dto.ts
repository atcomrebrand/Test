import { IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";

/**
 * `response` is the exact JSON `startRegistration()`/`startAuthentication()` (from
 * `@simplewebauthn/browser`) hands back — a nested, library-defined shape we don't want to
 * hand-duplicate field-by-field as class-validator decorators (easy to get subtly wrong and
 * silently reject a real login). `@IsObject()` only checks it's present and an object; the actual
 * security check is the cryptographic signature verification inside verifyRegistrationResponse/
 * verifyAuthenticationResponse, not shape validation here.
 */
export class RegistrationVerifyDto {
  @IsObject()
  response!: RegistrationResponseJSON;

  @IsOptional()
  @IsString()
  deviceName?: string;
}

export class LoginVerifyDto {
  @IsString()
  @IsNotEmpty()
  attemptId!: string;

  @IsObject()
  response!: AuthenticationResponseJSON;
}
