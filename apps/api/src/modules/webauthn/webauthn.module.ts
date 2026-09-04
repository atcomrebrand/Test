import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { WebAuthnController } from "./webauthn.controller";
import { WebAuthnService } from "./webauthn.service";

@Module({
  imports: [AuthModule],
  controllers: [WebAuthnController],
  providers: [WebAuthnService],
})
export class WebAuthnModule {}
