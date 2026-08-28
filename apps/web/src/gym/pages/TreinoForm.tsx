import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Reorder } from "framer-motion";
import { GripVertical, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCreateWorkout, useGymExercises, useGymProfile, useGymWorkout, useUpdateWorkout } from "../api";
import { REST_PRESETS } from "../domain/rest-timer";
import { EQUIPMENT_LABEL, GYM, MUSCLE_LABEL } from "../theme";
import { GymExercise, GymMuscle } from "../types";

interface Linha {
  key: string;
  exerciseId: string;
  name: string;
  primaryMuscle: GymMuscle;
  sets: number;
  targetRepsMin: number;
  targetRepsMax: number;
  targetWeight: number | null;
  restSeconds: number;
  notes: string;
}

export default function TreinoForm() {
  const { id } = useParams<{ id: string }>();
  const editando = !!id && id !== "novo";
  const navigate = useNavigate();
  const { data: ficha, isLoading } = useGymWorkout(editando ? id : undefined);
  const { data: perfil } = useGymProfile();
  const criar = useCreateWorkout();
  const atualizar = useUpdateWorkout();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [escolhendo, setEscolhendo] = useState(false);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (!ficha || pronto) return;
    setName(ficha.name);
    setDescription(ficha.description ?? "");
    setLinhas(
      ficha.exercises.map((e) => ({
        key: e.id,
        exerciseId: e.exerciseId,
        name: e.exercise.name,
        primaryMuscle: e.exercise.primaryMuscle,
        sets: e.sets,
        targetRepsMin: e.targetRepsMin,
        targetRepsMax: e.targetRepsMax,
        targetWeight: e.targetWeight,
        restSeconds: e.restSeconds,
        notes: e.notes ?? "",
      })),
    );
    setPronto(true);
  }, [ficha, pronto]);

  const salvando = criar.isPending || atualizar.isPending;
  const podeSalvar = name.trim().length > 0 && linhas.length > 0;

  function salvar() {
    const body = {
      name: name.trim(),
      description: description.trim() || undefined,
      exercises: linhas.map((l) => ({
        exerciseId: l.exerciseId,
        sets: l.sets,
        targetRepsMin: l.targetRepsMin,
        targetRepsMax: l.targetRepsMax,
        targetWeight: l.targetWeight ?? undefined,
        restSeconds: l.restSeconds,
        notes: l.notes.trim() || undefined,
      })),
    };
    const onSuccess = () => navigate("/academia/treinos");
    if (editando && id) atualizar.mutate({ id, ...body }, { onSuccess });
    else criar.mutate(body, { onSuccess });
  }

  if (editando && isLoading) return <Skeleton className="h-96 rounded-3xl" />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-black tracking-tight">{editando ? "Editar treino" : "Novo treino"}</h1>

      <Card>
        <CardContent className="space-y-3 py-4">
          <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Treino A" autoFocus />
          <Input
            label="Descrição"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Peito + Tríceps"
          />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Exercícios ({linhas.length})</h2>
        <Button variant="ghost" onClick={() => setEscolhendo(true)}>
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {linhas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[rgb(var(--border))] py-10 text-center text-sm text-muted">
          Nenhum exercício ainda. Toque em <strong>Adicionar</strong> pra escolher da biblioteca.
        </p>
      ) : (
        <Reorder.Group axis="y" values={linhas} onReorder={setLinhas} className="space-y-3">
          {linhas.map((linha) => (
            <Reorder.Item key={linha.key} value={linha}>
              <LinhaExercicio
                linha={linha}
                onChange={(patch) => setLinhas((ls) => ls.map((l) => (l.key === linha.key ? { ...l, ...patch } : l)))}
                onRemove={() => setLinhas((ls) => ls.filter((l) => l.key !== linha.key))}
              />
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => navigate("/academia/treinos")}>
          Cancelar
        </Button>
        <Button className="flex-1" disabled={!podeSalvar} loading={salvando} onClick={salvar}>
          {editando ? "Salvar alterações" : "Criar treino"}
        </Button>
      </div>

      <SeletorExercicio
        open={escolhendo}
        onClose={() => setEscolhendo(false)}
        onPick={(ex) =>
          setLinhas((ls) => [
            ...ls,
            {
              key: `${ex.id}-${Date.now()}`,
              exerciseId: ex.id,
              name: ex.name,
              primaryMuscle: ex.primaryMuscle,
              sets: 3,
              targetRepsMin: 8,
              targetRepsMax: 12,
              targetWeight: null,
              // Herda o padrão do perfil (§33) — e continua editável logo abaixo.
              restSeconds: perfil?.defaultRestSeconds ?? 90,
              notes: "",
            },
          ])
        }
      />
    </div>
  );
}

function LinhaExercicio({ linha, onChange, onRemove }: { linha: Linha; onChange: (p: Partial<Linha>) => void; onRemove: () => void }) {
  const [custom, setCustom] = useState(!REST_PRESETS.includes(linha.restSeconds as (typeof REST_PRESETS)[number]));

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center gap-2">
          <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-muted active:cursor-grabbing" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{linha.name}</p>
            <p className="text-xs text-muted">{MUSCLE_LABEL[linha.primaryMuscle]}</p>
          </div>
          <button
            onClick={onRemove}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-red-500/10 hover:text-red-500"
            aria-label={`Remover ${linha.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Campo label="Séries" value={linha.sets} onChange={(v) => onChange({ sets: Math.max(1, v) })} />
          <Campo label="Reps mín." value={linha.targetRepsMin} onChange={(v) => onChange({ targetRepsMin: Math.max(1, v) })} />
          <Campo label="Reps máx." value={linha.targetRepsMax} onChange={(v) => onChange({ targetRepsMax: Math.max(1, v) })} />
          <Campo
            label="Carga (kg)"
            value={linha.targetWeight ?? 0}
            decimal
            onChange={(v) => onChange({ targetWeight: v > 0 ? v : null })}
          />
        </div>

        {/* Descanso por exercício (§8) — a configuração que o cronômetro dispara em cada série. */}
        <div className="mt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Descanso</p>
          <div className="flex flex-wrap gap-1.5">
            {REST_PRESETS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setCustom(false);
                  onChange({ restSeconds: s });
                }}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                  !custom && linha.restSeconds === s ? cn("text-white", GYM.solid) : "surface-2 text-muted hover:brightness-95",
                )}
              >
                {s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${s}s`}
              </button>
            ))}
            <button
              onClick={() => setCustom(true)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                custom ? cn("text-white", GYM.solid) : "surface-2 text-muted hover:brightness-95",
              )}
            >
              Outro
            </button>
            {custom && (
              <input
                type="number"
                min={0}
                max={900}
                value={linha.restSeconds}
                onChange={(e) => onChange({ restSeconds: Math.max(0, Math.min(900, Number(e.target.value) || 0)) })}
                className="w-20 rounded-lg border border-[rgb(var(--border))] surface px-2 py-1.5 text-xs"
                aria-label="Descanso personalizado em segundos"
              />
            )}
          </div>
        </div>

        <input
          value={linha.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Observação (opcional)"
          className="mt-3 w-full rounded-lg border border-[rgb(var(--border))] surface px-3 py-2 text-sm"
        />
      </CardContent>
    </Card>
  );
}

function Campo({ label, value, onChange, decimal }: { label: string; value: number; onChange: (v: number) => void; decimal?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <input
        type="text"
        inputMode={decimal ? "decimal" : "numeric"}
        value={String(value).replace(".", ",")}
        onChange={(e) => onChange(Number(e.target.value.replace(",", ".")) || 0)}
        className="w-full rounded-lg border border-[rgb(var(--border))] surface px-3 py-2 text-sm font-semibold tabular-nums"
      />
    </label>
  );
}

/** Busca da biblioteca dentro do modal — a mesma do §23, sem sair da montagem do treino. */
function SeletorExercicio({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (ex: GymExercise) => void }) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<GymMuscle | null>(null);
  const { data: exercicios, isLoading } = useGymExercises({ query, muscle });

  const musculos = useMemo(() => Object.keys(MUSCLE_LABEL) as GymMuscle[], []);

  return (
    <Modal open={open} onClose={onClose} title="Escolher exercício">
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 rounded-xl border border-[rgb(var(--border))] surface px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, músculo ou equipamento..."
            className="w-full bg-transparent text-sm outline-none"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Limpar busca">
              <X className="h-4 w-4 text-muted" />
            </button>
          )}
        </label>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Chip active={muscle === null} onClick={() => setMuscle(null)}>Todos</Chip>
          {musculos.map((m) => (
            <Chip key={m} active={muscle === m} onClick={() => setMuscle(m)}>
              {MUSCLE_LABEL[m]}
            </Chip>
          ))}
        </div>

        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {isLoading && <Skeleton className="h-40" />}
          {exercicios?.length === 0 && <p className="py-8 text-center text-sm text-muted">Nada encontrado com esse filtro.</p>}
          {exercicios?.map((ex) => (
            <button
              key={ex.id}
              onClick={() => {
                onPick(ex);
                onClose();
              }}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-[rgb(var(--border))] px-3 py-2.5 text-left transition-colors hover:surface-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{ex.name}</p>
                <p className="text-xs text-muted">
                  {MUSCLE_LABEL[ex.primaryMuscle]} · {EQUIPMENT_LABEL[ex.equipment]}
                </p>
              </div>
              <Plus className="h-4 w-4 shrink-0 text-muted" />
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
        active ? cn("text-white", GYM.solid) : "surface-2 text-muted hover:brightness-95",
      )}
    >
      {children}
    </button>
  );
}
