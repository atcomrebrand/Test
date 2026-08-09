import "reflect-metadata";
import * as dns from "node:dns";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";

/** Known placeholder values from .env.example — if JWT_SECRET is missing or still one of these,
 *  every token this process signs is forgeable by anyone who reads the (public) source. Fail loud
 *  at boot instead of silently running with a guessable secret — this app now holds real financial
 *  data, so there's no dev-convenience justification for letting that slip into production. */
const INSECURE_JWT_SECRETS = new Set(["change-me-in-production", "dev-secret-change-me"]);

/**
 * A VPS resolve AAAA mas não tem rota IPv6 funcionando, então todo host que anuncia IPv6 — e o
 * Bacen, atrás do Azure Front Door, anuncia — ficava esperando o timeout antes de tentar IPv4.
 * Sob systemd isso passava do limite de 8s da chamada e virava um "fetch failed" silencioso, que
 * é como o CDI ficou preso no valor de fallback. Pedir IPv4 primeiro resolve pra todas as
 * integrações de saída de uma vez (Bacen, BRAPI, Yahoo, câmbio), sem depender da versão do Node.
 *
 * DNS_RESULT_ORDER permite voltar ao padrão ("verbatim") sem mexer no código, se um dia a VPS
 * ganhar IPv6 de verdade.
 */
function preferIpv4() {
  const order = process.env.DNS_RESULT_ORDER ?? "ipv4first";
  if (order === "verbatim" || order === "ipv4first" || order === "ipv6first") {
    dns.setDefaultResultOrder(order);
  }
}

function assertSecureEnv() {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || INSECURE_JWT_SECRETS.has(jwtSecret)) {
    throw new Error(
      "JWT_SECRET não está configurado (ou ainda é o valor de exemplo do .env.example). " +
        'Gere um valor forte com `node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"` ' +
        "e defina JWT_SECRET no .env antes de subir a API.",
    );
  }
}

async function bootstrap() {
  preferIpv4();
  assertSecureEnv();

  const app = await NestFactory.create(AppModule, { cors: false, bodyParser: false });

  // Express's default 100kb JSON limit is too small for the B3 statement import (a full year of
  // "Movimentação" can be several thousand rows) — raised globally since no other endpoint needs
  // anywhere near this, so the higher cap costs nothing elsewhere.
  app.use(json({ limit: "15mb" }));
  app.use(urlencoded({ extended: true, limit: "15mb" }));

  app.use(helmet());
  app.enableCors({
    origin: process.env.WEB_ORIGIN?.split(",") ?? "http://localhost:5173",
    credentials: true,
  });

  app.setGlobalPrefix("api/v1");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = process.env.PORT ? Number(process.env.PORT) : 3333;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API rodando em http://localhost:${port}/api/v1`);
}

bootstrap();
