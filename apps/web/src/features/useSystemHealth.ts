import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type HealthStatus = "OK" | "ATENCAO" | "CRITICO";

export interface HealthVerdict {
  status: HealthStatus;
  reason: string;
}

export interface SystemHealth {
  status: HealthStatus;
  collectedAt: string;
  memory: {
    totalBytes: number;
    availableBytes: number;
    usedBytes: number;
    /** Cache de disco — o Linux devolve na hora que precisar, então não conta como ocupado. */
    cachedBytes: number;
    swapTotalBytes: number;
    swapUsedBytes: number;
    verdict: HealthVerdict;
  };
  cpu: { cores: number; load1: number; load5: number; load15: number; verdict: HealthVerdict };
  disk: { totalBytes: number; freeBytes: number; usedPercent: number; verdict: HealthVerdict } | null;
  database: { sizeBytes: number; connections: number; maxConnections: number; verdict: HealthVerdict } | null;
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

/** Números que mudam a toda hora: recarrega sozinho enquanto a tela está aberta. O servidor já
 *  segura 5s de cache, então isso não vira pressão em cima da máquina que se quer medir. */
const REFETCH_MS = 10_000;

export function useSystemHealth(enabled = true) {
  return useQuery({
    queryKey: ["system", "health"],
    queryFn: () => api.get<SystemHealth>("/system/health"),
    refetchInterval: REFETCH_MS,
    enabled,
  });
}
