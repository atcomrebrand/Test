import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatDate } from "@/lib/format";
import { resizeImageToSquareDataUrl } from "@/lib/imageResize";
import { useCreatePhoto, useDeletePhoto, useGymPhotos } from "../api";
import { GYM } from "../theme";
import { GymPhotoPose } from "../types";

const POSES: { value: GymPhotoPose; label: string }[] = [
  { value: "FRENTE", label: "Frente" },
  { value: "COSTAS", label: "Costas" },
  { value: "LATERAL", label: "Lateral" },
];

/**
 * Fotos de evolução (§28).
 *
 * A privacidade é levada a sério do jeito que dá pra levar num app pessoal: a imagem é
 * redimensionada e guardada como data URL no próprio registro do usuário, nunca vai pra storage
 * público nem ganha URL adivinhável, e o servidor revalida tipo e tamanho. Comparar antes×depois é
 * escolher duas datas — nada é publicado em lugar nenhum.
 */
export function Fotos() {
  const { data: fotos, isLoading } = useGymPhotos();
  const criar = useCreatePhoto();
  const excluir = useDeletePhoto();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pose, setPose] = useState<GymPhotoPose>("FRENTE");
  const [antes, setAntes] = useState<string | null>(null);
  const [depois, setDepois] = useState<string | null>(null);

  if (isLoading) return <Skeleton className="h-64 rounded-2xl" />;

  const daPose = (fotos ?? []).filter((f) => f.pose === pose);
  const fotoAntes = daPose.find((f) => f.id === antes) ?? daPose[daPose.length - 1];
  const fotoDepois = daPose.find((f) => f.id === depois) ?? daPose[0];

  async function adicionar(file: File) {
    const dataUrl = await resizeImageToSquareDataUrl(file);
    criar.mutate({ date: new Date().toISOString(), pose, image: dataUrl });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {POSES.map((p) => (
            <button
              key={p.value}
              onClick={() => setPose(p.value)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                pose === p.value ? cn("text-neutral-900", GYM.solid) : "surface-2 text-muted hover:brightness-95",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Button onClick={() => inputRef.current?.click()} loading={criar.isPending}>
          <Camera className="h-4 w-4" />
          Adicionar
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void adicionar(file);
            e.target.value = "";
          }}
        />
      </div>

      {daPose.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[rgb(var(--border))] py-10 text-center text-sm text-muted">
          Nenhuma foto de {POSES.find((p) => p.value === pose)!.label.toLowerCase()} ainda.
        </p>
      ) : (
        <>
          {daPose.length > 1 && (
            <div className="grid grid-cols-2 gap-3">
              <Comparacao titulo="Antes" foto={fotoAntes} opcoes={daPose} onPick={setAntes} />
              <Comparacao titulo="Depois" foto={fotoDepois} opcoes={daPose} onPick={setDepois} />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {daPose.map((f) => (
              <div key={f.id} className="group relative overflow-hidden rounded-xl border border-[rgb(var(--border))]">
                <img src={f.image} alt={`Foto de ${f.pose.toLowerCase()} em ${formatDate(f.date)}`} className="aspect-square w-full object-cover" />
                <p className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-0.5 text-center text-[10px] font-medium text-white">
                  {formatDate(f.date, { day: "2-digit", month: "2-digit", year: "2-digit" })}
                </p>
                <button
                  onClick={() => excluir.mutate(f.id)}
                  className="absolute right-1 top-1 rounded-lg bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Excluir foto de ${formatDate(f.date)}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Comparacao({
  titulo,
  foto,
  opcoes,
  onPick,
}: {
  titulo: string;
  foto: { id: string; image: string; date: string } | undefined;
  opcoes: { id: string; date: string }[];
  onPick: (id: string) => void;
}) {
  if (!foto) return null;
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted">{titulo}</p>
      <img src={foto.image} alt={`${titulo}: ${formatDate(foto.date)}`} className="aspect-square w-full rounded-xl object-cover" />
      <select
        value={foto.id}
        onChange={(e) => onPick(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-[rgb(var(--border))] surface px-2 py-1.5 text-xs"
        aria-label={`Escolher foto de ${titulo.toLowerCase()}`}
      >
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {formatDate(o.date)}
          </option>
        ))}
      </select>
    </div>
  );
}
