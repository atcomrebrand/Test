import { useState } from "react";
import { Check, Plus, Target, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { useCreateTarget, useDeleteTarget, useGymExercises, useGymTargets, useUpdateTarget } from "../api";
import { GYM } from "../theme";
import { GymTargetKind } from "../types";

const TIPOS: { value: GymTargetKind; label: string; unidade: string }[] = [
  { value: "CARGA", label: "Carga num exercício", unidade: "kg" },
  { value: "FREQUENCIA_SEMANAL", label: "Treinos por semana", unidade: "treinos" },
  { value: "PESO_CORPORAL", label: "Peso corporal", unidade: "kg" },
];

/** Metas (§31). O valor atual vem sempre do dado real — meta não guarda progresso que envelhece. */
export function Metas() {
  const { data: metas, isLoading } = useGymTargets();
  const criar = useCreateTarget();
  const atualizar = useUpdateTarget();
  const excluir = useDeleteTarget();
  const [aberto, setAberto] = useState(false);
  const [kind, setKind] = useState<GymTargetKind>("CARGA");
  const [exerciseId, setExerciseId] = useState("");
  const [label, setLabel] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [startValue, setStartValue] = useState("");
  const { data: exercicios } = useGymExercises({ query: "" });

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;

  const tipo = TIPOS.find((t) => t.value === kind)!;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setAberto(true)}>
          <Plus className="h-4 w-4" />
          Nova meta
        </Button>
      </div>

      {(!metas || metas.length === 0) && (
        <p className="rounded-2xl border border-dashed border-[rgb(var(--border))] py-10 text-center text-sm text-muted">
          Nenhuma meta ainda. Uma boa primeira: a carga que você quer alcançar num exercício.
        </p>
      )}

      {metas?.map((m) => (
        <Card key={m.id}>
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate font-bold">
                  {m.achievedAt && <Check className={cn("h-4 w-4 shrink-0", GYM.text)} />}
                  {m.label}
                </p>
                <p className="text-xs text-muted">
                  {m.exerciseName ?? TIPOS.find((t) => t.value === m.kind)?.label}
                  {m.deadline && ` · até ${formatDate(m.deadline)}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => atualizar.mutate({ id: m.id, achieved: !m.achievedAt })}
                  className="rounded-lg p-2 text-muted transition-colors hover:surface-2"
                  aria-label={m.achievedAt ? "Reabrir meta" : "Marcar como alcançada"}
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => excluir.mutate(m.id)}
                  className="rounded-lg p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
                  aria-label={`Excluir meta ${m.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 flex items-baseline justify-between text-sm">
              <span className="font-bold">
                {m.currentValue === null ? "—" : m.currentValue}
                <span className="text-muted"> / {m.targetValue}</span>
              </span>
              <span className={cn("font-bold", GYM.text)}>{m.progressPercent}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full surface-2">
              <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${m.progressPercent}%` }} />
            </div>
            {m.startValue !== null && (
              <p className="mt-1.5 text-[11px] text-muted">
                Medido a partir de {m.startValue} — o quanto falta, não o quanto já existia.
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      <Modal open={aberto} onClose={() => setAberto(false)} title="Nova meta">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                onClick={() => setKind(t.value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  kind === t.value ? cn("text-white", GYM.solid) : "surface-2 text-muted hover:brightness-95",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {kind === "CARGA" && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Exercício</span>
              <select
                value={exerciseId}
                onChange={(e) => setExerciseId(e.target.value)}
                className="w-full rounded-lg border border-[rgb(var(--border))] surface px-3 py-2 text-sm"
              >
                <option value="">Escolha...</option>
                {exercicios?.slice(0, 200).map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Nome da meta</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Supino 100 kg"
              className="w-full rounded-lg border border-[rgb(var(--border))] surface px-3 py-2 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Alvo ({tipo.unidade})</span>
              <input
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                inputMode="decimal"
                className="w-full rounded-lg border border-[rgb(var(--border))] surface px-3 py-2 text-sm tabular-nums"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Partida (opcional)</span>
              <input
                value={startValue}
                onChange={(e) => setStartValue(e.target.value)}
                inputMode="decimal"
                placeholder="hoje"
                className="w-full rounded-lg border border-[rgb(var(--border))] surface px-3 py-2 text-sm tabular-nums"
              />
            </label>
          </div>

          <Button
            loading={criar.isPending}
            disabled={!label.trim() || !targetValue || (kind === "CARGA" && !exerciseId)}
            onClick={() =>
              criar.mutate(
                {
                  kind,
                  exerciseId: kind === "CARGA" ? exerciseId : undefined,
                  label: label.trim(),
                  targetValue: Number(targetValue.replace(",", ".")),
                  startValue: startValue ? Number(startValue.replace(",", ".")) : undefined,
                },
                {
                  onSuccess: () => {
                    setAberto(false);
                    setLabel("");
                    setTargetValue("");
                    setStartValue("");
                    setExerciseId("");
                  },
                },
              )
            }
          >
            <Target className="h-4 w-4" />
            Criar meta
          </Button>
        </div>
      </Modal>
    </div>
  );
}
