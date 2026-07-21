import { useState } from "react";
import { History as HistoryIcon, Plus, Pencil, Trash2, Play, Square, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { useTrackingHistory } from "../api";
import { TrackingHistoryItem } from "../types";

const ENTITY_LABEL: Record<string, string> = {
  TrackingJob: "Trabalho fixo",
  TrackingSession: "Sessão",
  TrackingProject: "Projeto extra",
  TrackingIncome: "Outra entrada",
};

const ACTION_META: Record<string, { label: string; icon: typeof Plus }> = {
  CREATE: { label: "cadastrado", icon: Plus },
  UPDATE: { label: "atualizado", icon: Pencil },
  DELETE: { label: "removido", icon: Trash2 },
  CHECK_IN: { label: "check-in registrado", icon: Play },
  CHECK_OUT: { label: "check-out registrado", icon: Square },
  MANUAL_EDIT: { label: "horário editado manualmente", icon: Pencil },
};

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  return String(v);
}

function diffFields(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diffs: { key: string; before: unknown; after: unknown }[] = [];
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      diffs.push({ key, before: before[key], after: after[key] });
    }
  }
  return diffs;
}

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data, isLoading } = useTrackingHistory(page);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={<HistoryIcon className="h-7 w-7" />}
        title="Nenhum lançamento ainda"
        description="Toda alteração — check-in, check-out, edição manual, criação/remoção de trabalhos e entradas — aparece aqui, com valor antigo e novo."
      />
    );
  }

  const groups = new Map<string, TrackingHistoryItem[]>();
  for (const item of data.items) {
    const key = dayKey(item.createdAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Histórico</h1>
        <p className="text-sm text-muted">Linha do tempo de todas as alterações, com valor anterior e novo.</p>
      </div>

      <div className="relative flex flex-col gap-6 pl-4">
        <div className="absolute bottom-0 left-[7px] top-1 w-px bg-[rgb(var(--border))]" />
        {Array.from(groups.entries()).map(([day, items]) => (
          <div key={day} className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase text-muted">{formatDate(day, { day: "2-digit", month: "long", year: "numeric" })}</p>
            {items.map((item) => {
              const meta = ACTION_META[item.action] ?? { label: item.action.toLowerCase(), icon: Wallet };
              const Icon = meta.icon;
              const diffs = diffFields(item.before, item.after);
              const isExpanded = expanded === item.id;
              return (
                <div key={item.id} className="relative flex items-start gap-3">
                  <div className="relative z-10 -ml-4 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-white">
                    <Icon className="h-2.5 w-2.5" />
                  </div>
                  <div className="flex-1">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : item.id)}
                      className="flex w-full items-center justify-between rounded-xl surface-2 px-3 py-2 text-left text-sm transition-colors hover:surface"
                    >
                      <span>
                        <span className="font-medium">{ENTITY_LABEL[item.entity] ?? item.entity}</span>{" "}
                        <span className="text-muted">{meta.label}</span>
                      </span>
                      <span className="text-xs text-muted">{formatDate(item.createdAt, { hour: "2-digit", minute: "2-digit" })}</span>
                    </button>
                    {isExpanded && diffs.length > 0 && (
                      <div className="mt-1 space-y-1 rounded-xl bg-violet-500/5 px-3 py-2 text-xs">
                        {diffs.map((d) => (
                          <div key={d.key} className="flex items-center justify-between gap-2">
                            <span className="text-muted">{d.key}</span>
                            <span>
                              <span className="text-muted line-through">{formatValue(d.before)}</span> →{" "}
                              <span className="font-medium text-[rgb(var(--text))]">{formatValue(d.after)}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-muted">
            {page} / {data.pagination.totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
