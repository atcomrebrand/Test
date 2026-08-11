import { ChangeEvent, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import { useUpdateAssetPhoto } from "@/features/useFinancings";
import { ImageResizeError, resizeImageToSquareDataUrl } from "@/lib/imageResize";
import { FINANCING_KIND_META } from "@/lib/financingKind";
import { matchAutomakerIcon } from "@/lib/carIcons";
import { Financing } from "@/types";

interface Props {
  financing: Financing;
  /** Lado da bolinha em px. */
  size?: number;
}

/**
 * Bolinha do bem financiado: a foto do carro/imóvel quando existe, senão o logo da montadora ou o
 * ícone do tipo. Reconhecer o próprio carro na lista é mais rápido que ler o nome — e o app é
 * pessoal, então a foto real vale mais que qualquer ilustração genérica.
 *
 * Clicar troca a foto; o X remove. Não tem variante só-leitura porque hoje a bolinha só aparece
 * na tela de Financiamentos, onde editar é sempre permitido.
 */
export function AssetAvatar({ financing, size = 44 }: Props) {
  const updatePhoto = useUpdateAssetPhoto();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);

  const meta = FINANCING_KIND_META[financing.kind];
  const automaker = financing.kind === "CAR" ? matchAutomakerIcon(financing.name) : null;
  const photo = financing.photo;
  const busy = preparing || updatePhoto.isPending;

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Zera o input antes de qualquer await: sem isso, escolher o MESMO arquivo de novo (depois de
    // remover a foto, por exemplo) não dispara change e a tela fica parada sem explicação.
    e.target.value = "";
    if (!file) return;

    setPreparing(true);
    try {
      const dataUrl = await resizeImageToSquareDataUrl(file);
      updatePhoto.mutate({ id: financing.id, photo: dataUrl });
    } catch (err) {
      toast.error(err instanceof ImageResizeError ? err.message : "Não consegui processar essa imagem.");
    } finally {
      setPreparing(false);
    }
  }

  const circle = (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: photo ? undefined : automaker ? "#fff" : `${meta.color}1a`,
        color: automaker ? automaker.color : meta.color,
      }}
    >
      {photo ? (
        <img src={photo} alt={financing.name} className="h-full w-full object-cover" />
      ) : automaker ? (
        <automaker.Icon style={{ width: size * 0.45, height: size * 0.45 }} />
      ) : (
        <meta.icon style={{ width: size * 0.45, height: size * 0.45 }} />
      )}

      {busy && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/50">
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        </span>
      )}
    </span>
  );

  return (
    <span className="relative inline-flex shrink-0">
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title={photo ? "Trocar a foto do bem" : "Adicionar uma foto do bem"}
        className="group relative rounded-full ring-1 ring-black/5 transition-transform hover:scale-105 disabled:cursor-wait"
      >
        {circle}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
          <Camera className="h-4 w-4 text-white" />
        </span>
      </button>

      {photo && !busy && (
        <button
          type="button"
          onClick={() => updatePhoto.mutate({ id: financing.id, photo: null })}
          title="Remover a foto"
          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[rgb(var(--surface))] text-muted shadow ring-1 ring-black/5 transition-colors hover:text-red-500"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
