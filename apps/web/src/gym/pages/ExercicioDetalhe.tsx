import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowLeft, Camera, Dumbbell, Lightbulb, ListOrdered, Pencil, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { resizeImageToSquareDataUrl } from "@/lib/imageResize";
import { useDeleteExercise, useGymExercise, useRemoveExercisePhoto, useSetExercisePhoto, useToggleFavorite } from "../api";
import { ExerciseFormModal } from "../components/ExerciseFormModal";
import { EQUIPMENT_LABEL, GYM, MUSCLE_LABEL } from "../theme";

export default function ExercicioDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: ex, isLoading } = useGymExercise(id);
  const favoritar = useToggleFavorite();
  const salvarFoto = useSetExercisePhoto();
  const tirarFoto = useRemoveExercisePhoto();
  const excluir = useDeleteExercise();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  async function escolherFoto(file: File) {
    if (!id) return;
    try {
      setErroFoto(null);
      salvarFoto.mutate({ id, image: await resizeImageToSquareDataUrl(file) });
    } catch (e) {
      setErroFoto(e instanceof Error ? e.message : "Não consegui ler essa imagem.");
    }
  }

  if (isLoading || !ex) return <Skeleton className="h-96 rounded-3xl" />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/academia/exercicios" className="flex w-fit items-center gap-1.5 text-sm text-muted hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Exercícios
      </Link>

      {/* A foto no topo, grande. É o que faz reconhecer o exercício de relance — e por isso ela
          vale mais aqui do que qualquer texto. Sem foto, o espaço vira um convite a pôr uma. */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative flex h-56 w-full items-center justify-center overflow-hidden rounded-3xl border border-[rgb(var(--border))] surface-2"
        aria-label={ex.image ? "Trocar a foto do exercício" : "Adicionar foto do exercício"}
      >
        {ex.image ? (
          <img src={ex.image} alt={ex.name} className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-muted">
            <Dumbbell className="h-10 w-10" />
            <span className="text-sm font-medium">Toque para adicionar uma foto</span>
          </span>
        )}
        {ex.image && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">
            <Camera className="h-3.5 w-3.5" />
            Trocar
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void escolherFoto(f);
          e.target.value = "";
        }}
      />
      {erroFoto && <p className="text-sm text-red-500">{erroFoto}</p>}
      {ex.hasUserPhoto && (
        <button
          onClick={() => id && tirarFoto.mutate(id)}
          className="flex w-fit items-center gap-1.5 text-xs text-muted hover:text-red-500 hover:underline"
        >
          <Trash2 className="h-3 w-3" />
          Remover a foto
        </button>
      )}

      <div className={cn("rounded-3xl border p-5", GYM.border, GYM.soft)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={cn("text-[11px] font-bold uppercase tracking-[0.2em]", GYM.text)}>{MUSCLE_LABEL[ex.primaryMuscle]}</p>
            <h1 className="mt-1 text-2xl font-black leading-tight">{ex.name}</h1>
          </div>
          <button
            onClick={() => favoritar.mutate(ex.id)}
            aria-label={ex.favorite ? "Desfavoritar" : "Favoritar"}
            aria-pressed={ex.favorite}
            className="shrink-0 rounded-xl p-2 transition-colors hover:surface-2"
          >
            <Star className={cn("h-5 w-5", ex.favorite ? cn("fill-current", GYM.text) : "text-muted")} />
          </button>
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Músculo principal</dt>
            <dd className="font-semibold">{MUSCLE_LABEL[ex.primaryMuscle]}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Equipamento</dt>
            <dd className="font-semibold">{EQUIPMENT_LABEL[ex.equipment]}</dd>
          </div>
          {ex.secondaryMuscles.length > 0 && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">Secundários</dt>
              <dd className="font-semibold">{ex.secondaryMuscles.map((m) => MUSCLE_LABEL[m]).join(" · ")}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Só o exercício que a pessoa criou é editável: o catálogo é global, e alterá-lo mexeria no
          exercício de todo mundo. A foto, essa sim, vale pros dois — ela é dela, não do catálogo. */}
      {ex.custom && (
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setEditando(true)}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
          <Button variant="ghost" onClick={() => setExcluindo(true)}>
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
        </div>
      )}

      {ex.instructions.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
              <ListOrdered className="h-3.5 w-3.5" />
              Como executar
            </p>
            <ol className="mt-3 space-y-2">
              {ex.instructions.map((passo, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-neutral-900", GYM.solid)}>
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{passo}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {ex.tips.length > 0 && (
          <Card>
            <CardContent className="py-4">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                <Lightbulb className="h-3.5 w-3.5" />
                Dicas
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {ex.tips.map((t, i) => (
                  <li key={i} className="text-muted">• {t}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        {ex.commonMistakes.length > 0 && (
          <Card>
            <CardContent className="py-4">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Erros comuns
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {ex.commonMistakes.map((m, i) => (
                  <li key={i} className="text-muted">• {m}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardContent className="py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Evolução da carga</p>
          {ex.loadEvolution.length < 2 ? (
            <p className="py-8 text-center text-sm text-muted">
              {ex.loadEvolution.length === 0
                ? "Você ainda não fez esse exercício — o histórico começa no primeiro treino."
                : "A curva aparece a partir da segunda vez que você fizer esse exercício."}
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={ex.loadEvolution} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v: string) => formatDate(v, { day: "2-digit", month: "short" })}
                  tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 13 }}
                  labelFormatter={(v: string) => formatDate(v, { day: "2-digit", month: "short", year: "numeric" })}
                  formatter={(v: number, name: string) => [`${v} kg`, name === "weight" ? "Carga" : "1RM estimado"]}
                />
                <Line type="monotone" dataKey="weight" name="weight" stroke={GYM.hex} strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="oneRm" name="oneRm" stroke="rgb(var(--text-muted))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {ex.history.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Histórico</p>
            <ul className="mt-2 divide-y divide-[rgb(var(--border))]">
              {ex.history.slice(0, 20).map((h) => (
                <li key={h.sessionId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="text-muted">{formatDate(h.date)}</span>
                  <span className="font-semibold tabular-nums">
                    {h.topWeight} kg × {h.topReps} · {h.sets} série{h.sets > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <ExerciseFormModal open={editando} onClose={() => setEditando(false)} exercise={ex} />

      <ConfirmModal
        open={excluindo}
        onClose={() => setExcluindo(false)}
        title="Excluir exercício"
        confirmLabel="Excluir"
        loading={excluir.isPending}
        onConfirm={() => id && excluir.mutate(id, { onSuccess: () => navigate("/academia/exercicios") })}
        description="Ele sai da biblioteca, mas continua no histórico dos treinos em que você já o fez — apagar de vez levaria o passado junto."
      />
    </div>
  );
}
