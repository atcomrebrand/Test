import { useState } from "react";
import { Activity, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { HealthStatus, HealthVerdict, useSystemHealth } from "@/features/useSystemHealth";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}

function formatUptime(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return "—";
  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${horas}h ${minutos}min`;
  return `${minutos}min`;
}

const TOM: Record<HealthStatus, string> = {
  OK: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  ATENCAO: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  CRITICO: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const BARRA: Record<HealthStatus, string> = {
  OK: "bg-emerald-500",
  ATENCAO: "bg-amber-500",
  CRITICO: "bg-red-500",
};

const ROTULO: Record<HealthStatus, string> = { OK: "Tudo certo", ATENCAO: "Atenção", CRITICO: "Crítico" };

function Selo({ status }: { status: HealthStatus }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TOM[status])}>{ROTULO[status]}</span>;
}

/** Barra + o motivo escrito embaixo. A cor sozinha diz que algo está ruim, não o quê — e cor
 *  sozinha também não serve pra quem não distingue verde de vermelho. */
function Medidor({ label, usado, total, detalhe, verdict }: { label: string; usado: number; total: number; detalhe: string; verdict: HealthVerdict }) {
  const percent = total > 0 ? Math.min(100, (usado / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted">{detalhe}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full surface-2">
        <div className={cn("h-full rounded-full transition-all", BARRA[verdict.status])} style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-muted">{verdict.reason}</p>
    </div>
  );
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium">{valor}</span>
    </div>
  );
}

/**
 * Saúde da máquina onde a API roda: memória, CPU, disco, banco e o processo da própria API.
 *
 * Existe pra responder "tem gargalo?" sem abrir SSH — e a resposta que interessa numa VPS de 1GB
 * quase nunca é a porcentagem de memória "usada", que o Linux deixa alta de propósito com cache. É
 * o **disponível** e o **swap**, que é o que os medidores mostram.
 */
export function SystemHealthCard() {
  const [aberto, setAberto] = useState(false);
  // Só consulta quando o card está aberto: fechado, ele não fica batendo na máquina de 10 em 10s.
  const { data, isLoading, isFetching, refetch } = useSystemHealth(aberto);

  const servicosConhecidos = (data?.services ?? []).filter((s) => s.memoryBytes !== null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted" />
          Saúde do servidor
          {aberto && data && <Selo status={data.status} />}
        </CardTitle>
        <div className="flex items-center gap-1">
          {aberto && (
            <Button variant="ghost" size="sm" onClick={() => refetch()} aria-label="Atualizar agora">
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}>
            {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {aberto && (
        <CardContent className="flex flex-col gap-4">
          {isLoading || !data ? (
            <Skeleton className="h-64" />
          ) : (
            <>
              <Medidor
                label="Memória"
                usado={data.memory.usedBytes}
                total={data.memory.totalBytes}
                detalhe={`${formatBytes(data.memory.availableBytes)} livres de ${formatBytes(data.memory.totalBytes)}`}
                verdict={data.memory.verdict}
              />

              {/* Dito em voz alta porque é a leitura errada mais comum: cache ocupa RAM e não é
                  memória perdida — o sistema devolve assim que alguém precisar. */}
              {data.memory.cachedBytes > 0 && (
                <p className="-mt-2 text-[11px] text-muted">
                  {formatBytes(data.memory.cachedBytes)} disso é cache de disco, que conta como livre.
                  {data.memory.swapTotalBytes > 0 &&
                    ` Swap: ${formatBytes(data.memory.swapUsedBytes)} de ${formatBytes(data.memory.swapTotalBytes)}.`}
                </p>
              )}

              {data.disk && (
                <Medidor
                  label="Disco"
                  usado={data.disk.totalBytes - data.disk.freeBytes}
                  total={data.disk.totalBytes}
                  detalhe={`${formatBytes(data.disk.freeBytes)} livres de ${formatBytes(data.disk.totalBytes)}`}
                  verdict={data.disk.verdict}
                />
              )}

              <div className="surface-2 flex flex-col gap-1.5 rounded-xl p-3">
                <Linha label={`Carga (${data.cpu.cores} núcleo${data.cpu.cores > 1 ? "s" : ""})`} valor={`${data.cpu.load1.toFixed(2)} · ${data.cpu.load5.toFixed(2)} · ${data.cpu.load15.toFixed(2)}`} />
                <p className="-mt-1 text-[11px] text-muted">{data.cpu.verdict.reason} Médias de 1, 5 e 15 minutos.</p>
                <Linha label="Servidor ligado há" valor={formatUptime(data.hostUptimeSeconds)} />
              </div>

              <div className="surface-2 flex flex-col gap-1.5 rounded-xl p-3">
                <p className="text-xs font-semibold text-muted">API</p>
                {/* RSS é o que a máquina enxerga; o heap é o que o código está segurando. Heap
                    subindo sem parar entre visitas é o sinal de vazamento — RSS sozinho oscila
                    demais pra servir de alarme. */}
                <Linha label="Memória do processo" valor={formatBytes(data.process.rssBytes)} />
                <Linha label="Heap em uso" valor={`${formatBytes(data.process.heapUsedBytes)} de ${formatBytes(data.process.heapTotalBytes)}`} />
                <Linha label="No ar há" valor={formatUptime(data.process.uptimeSeconds)} />
                <Linha label="Node" valor={data.process.nodeVersion} />
              </div>

              {data.database && (
                <div className="surface-2 flex flex-col gap-1.5 rounded-xl p-3">
                  <p className="text-xs font-semibold text-muted">Banco</p>
                  <Linha label="Tamanho" valor={formatBytes(data.database.sizeBytes)} />
                  <Linha label="Conexões" valor={`${data.database.connections} de ${data.database.maxConnections}`} />
                  <p className="-mt-1 text-[11px] text-muted">{data.database.verdict.reason}</p>
                </div>
              )}

              {servicosConhecidos.length > 0 && (
                <div className="surface-2 flex flex-col gap-1.5 rounded-xl p-3">
                  <p className="text-xs font-semibold text-muted">Serviços</p>
                  {servicosConhecidos.map((servico) => (
                    <Linha
                      key={servico.name}
                      label={servico.name}
                      valor={`${formatBytes(servico.memoryBytes ?? 0)}${servico.restarts ? ` · ${servico.restarts} reinício(s)` : ""}`}
                    />
                  ))}
                  {/* Reinício acumulado é o rastro que o sistema deixa quando mata o processo por
                      falta de memória — numa VPS de 1GB, é o primeiro lugar pra olhar. */}
                  <p className="-mt-1 text-[11px] text-muted">Memória medida pelo systemd, por serviço.</p>
                </div>
              )}

              <p className="text-[11px] text-muted">
                Atualiza sozinho a cada 10s enquanto este card está aberto.
              </p>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
