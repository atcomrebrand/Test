import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Reorder } from "framer-motion";
import { Copy, Dumbbell, GripVertical, Plus, Timer, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { useDeleteWorkout, useDuplicateWorkout, useGymWorkouts, useReorderWorkouts, useWorkoutPrefill } from "../api";
import { useGymSessionStore } from "../store/session";
import { formatMinutes, GYM, MUSCLE_LABEL } from "../theme";
import { GymWorkout } from "../types";

export default function Treinos() {
  const { data: fichas, isLoading } = useGymWorkouts();
  const reordenar = useReorderWorkouts();
  const duplicar = useDuplicateWorkout();
  const excluir = useDeleteWorkout();
  const [ordem, setOrdem] = useState<GymWorkout[] | null>(null);
  const [excluindo, setExcluindo] = useState<GymWorkout | null>(null);

  if (isLoading) return <Skeleton className="h-64 rounded-3xl" />;

  const lista = ordem ?? fichas ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Meus treinos</h1>
          <p className="text-sm text-muted">Arraste para reordenar.</p>
        </div>
        <Link to="/academia/treinos/novo">
          <Button>
            <Plus className="h-4 w-4" />
            Novo treino
          </Button>
        </Link>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="h-7 w-7" />}
          title="Nenhuma ficha ainda"
          description="Um treino é uma lista de exercícios com séries, repetições, carga e o descanso de cada um."
          action={
            <Link to="/academia/treinos/novo">
              <Button>Montar o primeiro</Button>
            </Link>
          }
        />
      ) : (
        <Reorder.Group
          axis="y"
          values={lista}
          onReorder={(nova) => setOrdem(nova as GymWorkout[])}
          className="space-y-3"
        >
          {lista.map((ficha) => (
            <Reorder.Item
              key={ficha.id}
              value={ficha}
              // A ordem só vai pro servidor quando o dedo solta: gravar a cada pixel de arrasto
              // seria uma requisição por quadro.
              onDragEnd={() => reordenar.mutate((ordem ?? lista).map((f) => f.id))}
            >
              <Card>
                <CardContent className="flex items-center gap-3 py-4">
                  <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-muted active:cursor-grabbing" />
                  <Link to={`/academia/treinos/${ficha.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold">{ficha.name}</p>
                    <p className="truncate text-sm text-muted">
                      {ficha.description || ficha.muscles.map((m) => MUSCLE_LABEL[m]).join(" + ") || "Sem exercícios"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted">
                      <span>{ficha.exerciseCount} exercícios</span>
                      <span>{ficha.totalSets} séries</span>
                      <span className="flex items-center gap-1">
                        <Timer className="h-3 w-3" />~{Math.round(ficha.estimatedSeconds / 60)} min
                      </span>
                      {ficha.lastPerformedAt && <span>Última: {formatDate(ficha.lastPerformedAt)}</span>}
                      {ficha.averageDurationSeconds && <span>Média: {formatMinutes(ficha.averageDurationSeconds)}</span>}
                    </div>
                  </Link>

                  <div className="flex shrink-0 items-center gap-1">
                    <IniciarBotao workout={ficha} />
                    <button
                      onClick={() => duplicar.mutate(ficha.id)}
                      className="rounded-lg p-2 text-muted transition-colors hover:surface-2"
                      aria-label={`Duplicar ${ficha.name}`}
                      title="Duplicar"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setExcluindo(ficha)}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                      aria-label={`Excluir ${ficha.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      <ConfirmModal
        open={!!excluindo}
        onClose={() => setExcluindo(null)}
        title="Excluir treino"
        confirmLabel="Excluir"
        loading={excluir.isPending}
        onConfirm={() => {
          if (!excluindo) return;
          excluir.mutate(excluindo.id, { onSuccess: () => { setExcluindo(null); setOrdem(null); } });
        }}
        description="Os treinos que você já fez com essa ficha continuam no histórico — só a ficha sai da lista."
      />
    </div>
  );
}

/** Começa a sessão com os dados já carregados: o modo treino não pode depender de rede. */
function IniciarBotao({ workout }: { workout: GymWorkout }) {
  const navigate = useNavigate();
  const start = useGymSessionStore((s) => s.start);
  const ativa = useGymSessionStore((s) => s.session);
  const { data: prefill } = useWorkoutPrefill(workout.id);

  if (workout.exerciseCount === 0) return null;

  return (
    <button
      onClick={() => {
        if (ativa) return navigate("/academia/executar");
        if (!prefill) return;
        start(prefill);
        navigate("/academia/executar");
      }}
      className={cn("rounded-lg px-3 py-2 text-xs font-bold uppercase text-white", GYM.solid)}
    >
      Iniciar
    </button>
  );
}
