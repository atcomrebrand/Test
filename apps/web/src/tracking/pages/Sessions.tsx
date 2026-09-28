import { useMemo, useState } from "react";
import { Pencil, Trash2, Timer, Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatHMS } from "../lib/sessionTime";
import { useTrackingSessions, useDeleteSession } from "../api";
import { EditSessionModal } from "../components/EditSessionModal";
import { TrackingSession } from "../types";

function formatTimeRange(session: TrackingSession) {
  const start = new Date(session.checkIn).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const end = session.checkOut ? new Date(session.checkOut).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
  return `${start} — ${end}`;
}

/** Lista todas as sessões já finalizadas (qualquer trabalho, fixo ou freelance) pra corrigir um
 *  horário lançado errado — por trabalho (busca) ou por dia (ordenado do mais recente pro mais
 *  antigo). A sessão em andamento não aparece aqui: ela é editada ao vivo no Modo Foco. */
export default function Sessions() {
  const { data, isLoading } = useTrackingSessions();
  const remove = useDeleteSession();
  const [query, setQuery] = useState("");
  const [editingSession, setEditingSession] = useState<TrackingSession | null>(null);

  const sessions = useMemo(() => {
    const completed = (data ?? []).filter((s) => s.status === "COMPLETED");
    const q = query.trim().toLowerCase();
    const filtered = q
      ? completed.filter((s) => s.job.name.toLowerCase().includes(q) || s.job.company.toLowerCase().includes(q))
      : completed;
    return filtered.sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime());
  }, [data, query]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Sessões</h1>
        <p className="text-sm text-muted">Corrija o horário de uma sessão já registrada, por trabalho ou por dia.</p>
      </div>

      <Input
        placeholder="Buscar por trabalho ou empresa..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-md"
      />

      {isLoading && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && sessions.length === 0 && query.trim().length === 0 && (
        <EmptyState
          icon={<Timer className="h-7 w-7" />}
          title="Nenhuma sessão registrada"
          description="Cronometre uma sessão no Modo Foco ou adicione uma sessão retroativa pra ela aparecer aqui."
        />
      )}

      {!isLoading && sessions.length === 0 && query.trim().length > 0 && (
        <EmptyState icon={<SearchIcon className="h-7 w-7" />} title="Nada encontrado" description={`Nenhuma sessão bate com "${query}".`} />
      )}

      <div className="flex flex-col gap-2">
        {sessions.map((session) => (
          <Card key={session.id}>
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: session.job.color }} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {session.job.name} — {session.job.company}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(session.checkIn)} · {formatTimeRange(session)} · {formatHMS(session.netSeconds)}
                  </p>
                  {session.notes && <p className="mt-0.5 truncate text-xs text-muted">{session.notes}</p>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(session.equivalentValue)}</p>
                <button
                  onClick={() => setEditingSession(session)}
                  className="rounded-lg p-1.5 text-muted transition-colors hover:surface-2"
                  aria-label="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => remove.mutate(session.id)}
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <EditSessionModal open={!!editingSession} onClose={() => setEditingSession(null)} session={editingSession} />
    </div>
  );
}
