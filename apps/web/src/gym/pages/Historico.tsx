import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardContent } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { usePrivacyStore } from "@/store/privacy";
import { useDeleteSession, useGymSessions } from "../api";
import { formatMinutes, formatVolume, GYM } from "../theme";
import { GymSessionSummary } from "../types";

type Periodo = "HOJE" | "SEMANA" | "MES" | "ANO" | "TUDO";

const PERIODOS: { value: Periodo; label: string; dias: number | null }[] = [
  { value: "HOJE", label: "Hoje", dias: 1 },
  { value: "SEMANA", label: "Semana", dias: 7 },
  { value: "MES", label: "Mês", dias: 30 },
  { value: "ANO", label: "Ano", dias: 365 },
  { value: "TUDO", label: "Tudo", dias: null },
];

export default function Historico() {
  const [periodo, setPeriodo] = useState<Periodo>("MES");
  const [excluindo, setExcluindo] = useState<GymSessionSummary | null>(null);
  const hidden = usePrivacyStore((s) => s.hidden);
  const excluir = useDeleteSession();

  const dias = PERIODOS.find((p) => p.value === periodo)!.dias;
  const from = dias === null ? undefined : new Date(Date.now() - dias * 86400000).toISOString();
  const { data: sessoes, isLoading } = useGymSessions(from ? { from } : undefined);

  const totais = (sessoes ?? []).reduce(
    (acc, s) => ({
      volume: acc.volume + s.totalVolume,
      minutos: acc.minutos + Math.round((s.durationSeconds ?? 0) / 60),
      series: acc.series + s.setCount,
    }),
    { volume: 0, minutos: 0, series: 0 },
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-black tracking-tight">Histórico</h1>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {PERIODOS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriodo(p.value)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
              periodo === p.value ? cn("text-white", GYM.solid) : "surface-2 text-muted hover:brightness-95",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : sessoes?.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-7 w-7" />}
          title="Nenhum treino nesse período"
          description="Escolha um intervalo maior ou comece um treino agora."
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Resumo label="Treinos" value={String(sessoes?.length ?? 0)} />
            <Resumo label="Volume" value={formatVolume(totais.volume, hidden)} />
            <Resumo label="Tempo" value={formatMinutes(totais.minutos * 60)} />
          </div>

          <div className="space-y-2">
            {sessoes?.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex items-center gap-3 py-3">
                  <Link to={`/academia/historico/${s.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.name}</p>
                    <p className="text-xs text-muted">
                      {formatDate(s.startedAt)} · {formatMinutes(s.durationSeconds)} · {s.exerciseCount} exercícios · {s.setCount} séries
                    </p>
                  </Link>
                  <span className="shrink-0 text-sm font-bold tabular-nums">{formatVolume(s.totalVolume, hidden)}</span>
                  <button
                    onClick={() => setExcluindo(s)}
                    className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                    aria-label={`Excluir treino de ${formatDate(s.startedAt)}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <ConfirmModal
        open={!!excluindo}
        onClose={() => setExcluindo(null)}
        title="Excluir treino"
        confirmLabel="Excluir"
        loading={excluir.isPending}
        onConfirm={() => excluindo && excluir.mutate(excluindo.id, { onSuccess: () => setExcluindo(null) })}
        description="As séries e os recordes conquistados nesse treino saem junto — recorde de um treino apagado não é recorde de nada."
      />
    </div>
  );
}

function Resumo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-black">{value}</p>
    </div>
  );
}
