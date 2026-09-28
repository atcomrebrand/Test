import { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { resizeImageToSquareDataUrl } from "@/lib/imageResize";
import { useCreateExercise, useUpdateExercise } from "../api";
import { EQUIPMENT_LABEL, GYM, MUSCLE_LABEL } from "../theme";
import { GymEquipment, GymExerciseDetail, GymMuscle } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Quando vem, o modal edita em vez de criar. Só exercício próprio é editável. */
  exercise?: GymExerciseDetail | null;
}

/**
 * Criar (ou editar) um exercício próprio.
 *
 * Pede o mínimo: nome, músculo e equipamento. Execução, dicas e erros comuns são opcionais — quem
 * está cadastrando "rosca do meu professor" quer sair da tela em dez segundos, e um formulário que
 * exige seis campos de texto é um formulário que ninguém preenche duas vezes.
 */
export function ExerciseFormModal({ open, onClose, exercise }: Props) {
  const criar = useCreateExercise();
  const atualizar = useUpdateExercise();
  const inputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [primaryMuscle, setPrimary] = useState<GymMuscle>("PEITO");
  const [equipment, setEquipment] = useState<GymEquipment>("BARRA");
  const [secondary, setSecondary] = useState<GymMuscle[]>([]);
  const [instructions, setInstructions] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(exercise?.name ?? "");
    setPrimary(exercise?.primaryMuscle ?? "PEITO");
    setEquipment(exercise?.equipment ?? "BARRA");
    setSecondary(exercise?.secondaryMuscles ?? []);
    setInstructions(exercise?.instructions.join("\n") ?? "");
    setImage(exercise?.image ?? null);
    setErro(null);
  }, [open, exercise]);

  async function escolherFoto(file: File) {
    try {
      setImage(await resizeImageToSquareDataUrl(file));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui ler essa imagem.");
    }
  }

  function salvar() {
    const body = {
      name: name.trim(),
      primaryMuscle,
      equipment,
      secondaryMuscles: secondary,
      // Uma linha por passo: é como o catálogo guarda, e como a tela de detalhe numera.
      instructions: instructions.split("\n").map((l) => l.trim()).filter(Boolean),
      image,
    };
    const onSuccess = () => onClose();
    if (exercise) atualizar.mutate({ id: exercise.id, ...body }, { onSuccess });
    else criar.mutate(body, { onSuccess });
  }

  const salvando = criar.isPending || atualizar.isPending;
  const musculos = Object.keys(MUSCLE_LABEL) as GymMuscle[];
  const equipamentos = Object.keys(EQUIPMENT_LABEL) as GymEquipment[];

  return (
    <Modal open={open} onClose={onClose} title={exercise ? "Editar exercício" : "Novo exercício"}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-[rgb(var(--border))] surface-2 text-muted"
            aria-label="Escolher foto do exercício"
          >
            {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <Camera className="h-6 w-6" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Foto do exercício</p>
            <p className="text-xs text-muted">Opcional. A imagem é cortada num quadrado e fica só na sua conta.</p>
            {image && (
              <button onClick={() => setImage(null)} className="mt-1 flex items-center gap-1 text-xs text-red-500 hover:underline">
                <Trash2 className="h-3 w-3" />
                Remover
              </button>
            )}
          </div>
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
        </div>

        {/* `id` explícito: sem ele o `Input` não associa o rótulo ao campo, e leitor de tela
            (ou teste) não acha o campo pelo nome dele. */}
        <Input
          id="gym-exercise-name"
          label="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Supino com halteres neutro"
          autoFocus
        />

        <Grupo label="Músculo principal">
          {musculos.map((m) => (
            <Chip key={m} ativo={primaryMuscle === m} onClick={() => setPrimary(m)}>
              {MUSCLE_LABEL[m]}
            </Chip>
          ))}
        </Grupo>

        <Grupo label="Equipamento">
          {equipamentos.map((eq) => (
            <Chip key={eq} ativo={equipment === eq} onClick={() => setEquipment(eq)}>
              {EQUIPMENT_LABEL[eq]}
            </Chip>
          ))}
        </Grupo>

        <Grupo label="Músculos secundários (opcional)">
          {musculos
            .filter((m) => m !== primaryMuscle)
            .map((m) => (
              <Chip
                key={m}
                ativo={secondary.includes(m)}
                onClick={() => setSecondary((s) => (s.includes(m) ? s.filter((x) => x !== m) : [...s, m]))}
              >
                {MUSCLE_LABEL[m]}
              </Chip>
            ))}
        </Grupo>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Como executar (opcional)</span>
          <textarea
            aria-label="Como executar"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={4}
            placeholder={"Um passo por linha.\nEx.: Deite no banco com os pés firmes no chão."}
            className="w-full rounded-lg border border-[rgb(var(--border))] surface px-3 py-2 text-sm"
          />
        </label>

        {erro && <p className="text-sm text-red-500">{erro}</p>}

        <Button disabled={!name.trim()} loading={salvando} onClick={salvar}>
          {exercise ? "Salvar alterações" : "Criar exercício"}
        </Button>
      </div>
    </Modal>
  );
}

function Grupo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors",
        ativo ? cn("text-neutral-900", GYM.solid) : "surface-2 text-muted hover:brightness-95",
      )}
    >
      {children}
    </button>
  );
}
