import { Injectable, Logger } from "@nestjs/common";
import { execFile } from "child_process";
import { readFile, statfs } from "fs/promises";
import { cpus, freemem, loadavg, totalmem, uptime as osUptime } from "os";
import { promisify } from "util";
import { PrismaService } from "../../../prisma/prisma.service";
import {
  classifyConnections,
  classifyDisk,
  classifyLoad,
  classifyMemory,
  HealthStatus,
  HealthVerdict,
  parseMemInfo,
  worstStatus,
} from "../domain/system-health";

const execFileAsync = promisify(execFile);

/** Unidades que a gente controla nesta VPS. Lista fixa: nada aqui vem do usuário, então não há
 *  argumento pra injetar — e o `execFile` (sem shell) fecha a porta de qualquer jeito. */
const UNIDADES = ["parcelas-api", "postgresql", "caddy"];

/** A tela é de configurações e recarrega sozinha; sem um respiro, cada visita abriria três
 *  processos e três consultas ao Postgres. */
const TTL_MS = 5000;

export interface SystemHealth {
  status: HealthStatus;
  collectedAt: string;
  memory: {
    totalBytes: number;
    availableBytes: number;
    usedBytes: number;
    /** Cache de disco: aparece separado justamente pra não ser lido como memória ocupada. */
    cachedBytes: number;
    swapTotalBytes: number;
    swapUsedBytes: number;
    verdict: HealthVerdict;
  };
  cpu: { cores: number; load1: number; load5: number; load15: number; verdict: HealthVerdict };
  disk: { totalBytes: number; freeBytes: number; usedPercent: number; verdict: HealthVerdict } | null;
  database: { sizeBytes: number; connections: number; maxConnections: number; verdict: HealthVerdict } | null;
  /** A própria API: é o processo que a gente escreve, então é o suspeito natural de vazamento. */
  process: {
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    externalBytes: number;
    uptimeSeconds: number;
    nodeVersion: string;
  };
  services: { name: string; memoryBytes: number | null; uptimeSeconds: number | null; restarts: number | null }[];
  hostUptimeSeconds: number;
}

/**
 * Retrato de RAM, CPU, disco e banco da máquina onde a API está rodando.
 *
 * Lê `/proc/meminfo` direto em vez de confiar só no `os`: o que interessa é o **MemAvailable**, e
 * `os.freemem()` nem sempre é ele (depende da versão do libuv). Fora do Linux o arquivo não existe
 * e a leitura cai no `os`, que é aproximado mas não quebra o ambiente de desenvolvimento.
 *
 * Nada aqui pode derrubar a tela: cada fonte é opcional e falha em silêncio pro seu próprio campo.
 * Uma página de diagnóstico que não abre quando a máquina está mal é o oposto do que ela serve.
 */
@Injectable()
export class SystemMetricsService {
  private readonly logger = new Logger(SystemMetricsService.name);
  private cache: { health: SystemHealth; at: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async health(): Promise<SystemHealth> {
    if (this.cache && Date.now() - this.cache.at < TTL_MS) return this.cache.health;

    const [memoria, disco, banco, servicos] = await Promise.all([
      this.readMemory(),
      this.readDisk(),
      this.readDatabase(),
      this.readServices(),
    ]);

    const cargas = loadavg();
    const nucleos = cpus().length;
    const cpu = {
      cores: nucleos,
      load1: cargas[0],
      load5: cargas[1],
      load15: cargas[2],
      verdict: classifyLoad(cargas[0], nucleos),
    };

    const uso = process.memoryUsage();
    const health: SystemHealth = {
      status: worstStatus([memoria.verdict, cpu.verdict, disco?.verdict, banco?.verdict].filter((v): v is HealthVerdict => !!v)),
      collectedAt: new Date().toISOString(),
      memory: memoria,
      cpu,
      disk: disco,
      database: banco,
      process: {
        rssBytes: uso.rss,
        heapUsedBytes: uso.heapUsed,
        heapTotalBytes: uso.heapTotal,
        externalBytes: uso.external,
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion: process.version,
      },
      services: servicos,
      hostUptimeSeconds: Math.round(osUptime()),
    };

    this.cache = { health, at: Date.now() };
    return health;
  }

  private async readMemory(): Promise<SystemHealth["memory"]> {
    let total = totalmem();
    let disponivel = freemem();
    let cache = 0;
    let swapTotal = 0;
    let swapLivre = 0;

    try {
      const info = parseMemInfo(await readFile("/proc/meminfo", "utf8"));
      if (info.MemTotal) total = info.MemTotal;
      if (info.MemAvailable) disponivel = info.MemAvailable;
      cache = (info.Cached ?? 0) + (info.Buffers ?? 0);
      swapTotal = info.SwapTotal ?? 0;
      swapLivre = info.SwapFree ?? 0;
    } catch {
      // Não é Linux (ou /proc não está montado): segue com o que o `os` deu.
    }

    return {
      totalBytes: total,
      availableBytes: disponivel,
      usedBytes: Math.max(0, total - disponivel),
      cachedBytes: cache,
      swapTotalBytes: swapTotal,
      swapUsedBytes: Math.max(0, swapTotal - swapLivre),
      verdict: classifyMemory({ totalBytes: total, availableBytes: disponivel, swapTotalBytes: swapTotal, swapFreeBytes: swapLivre }),
    };
  }

  private async readDisk(): Promise<SystemHealth["disk"]> {
    try {
      const fs = await statfs("/");
      const total = fs.blocks * fs.bsize;
      // `bavail` e não `bfree`: parte do disco é reservada pro root e não está disponível pro app.
      const livre = fs.bavail * fs.bsize;
      const usadoPercent = total > 0 ? ((total - livre) / total) * 100 : 0;
      return { totalBytes: total, freeBytes: livre, usedPercent: usadoPercent, verdict: classifyDisk(usadoPercent) };
    } catch {
      return null;
    }
  }

  private async readDatabase(): Promise<SystemHealth["database"]> {
    try {
      const [tamanho, conexoes, limite] = await Promise.all([
        this.prisma.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database()) AS size`,
        this.prisma.$queryRaw<{ total: bigint }[]>`SELECT count(*) AS total FROM pg_stat_activity WHERE datname = current_database()`,
        this.prisma.$queryRaw<{ setting: string }[]>`SELECT setting FROM pg_settings WHERE name = 'max_connections'`,
      ]);

      const usadas = Number(conexoes[0]?.total ?? 0);
      const maximo = Number(limite[0]?.setting ?? 0);
      return {
        sizeBytes: Number(tamanho[0]?.size ?? 0),
        connections: usadas,
        maxConnections: maximo,
        verdict: classifyConnections(usadas, maximo),
      };
    } catch (err) {
      this.logger.warn(`Sem métricas do Postgres: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Memória por serviço vem do systemd (contabilidade de cgroup), não de somar processo por
   * processo: o Postgres sozinho abre um processo por conexão, e somar RSS conta a memória
   * compartilhada entre eles várias vezes.
   */
  private async readServices(): Promise<SystemHealth["services"]> {
    return Promise.all(
      UNIDADES.map(async (name) => {
        try {
          const { stdout } = await execFileAsync(
            "systemctl",
            ["show", name, "--property=MemoryCurrent", "--property=NRestarts", "--property=ActiveEnterTimestampMonotonic"],
            { timeout: 3000 },
          );
          const campos = Object.fromEntries(
            stdout
              .split("\n")
              .map((linha) => linha.split("="))
              .filter((par) => par.length === 2),
          ) as Record<string, string>;

          // O systemd devolve "[not set]" quando a unidade não existe ou não contabiliza memória.
          const memoria = Number(campos.MemoryCurrent);
          const desdeMicros = Number(campos.ActiveEnterTimestampMonotonic);
          return {
            name,
            memoryBytes: Number.isFinite(memoria) && memoria > 0 ? memoria : null,
            uptimeSeconds: desdeMicros > 0 ? Math.round(osUptime() - desdeMicros / 1_000_000) : null,
            restarts: Number.isFinite(Number(campos.NRestarts)) ? Number(campos.NRestarts) : null,
          };
        } catch {
          // Sem systemd (desenvolvimento, contêiner) o card simplesmente não mostra a linha.
          return { name, memoryBytes: null, uptimeSeconds: null, restarts: null };
        }
      }),
    );
  }
}
