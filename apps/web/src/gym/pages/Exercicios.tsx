import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Star, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useGymExercises, useToggleFavorite } from "../api";
import { EQUIPMENT_LABEL, GYM, MUSCLE_LABEL } from "../theme";
import { GymEquipment, GymMuscle } from "../types";

export default function Exercicios() {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<GymMuscle | null>(null);
  const [equipment, setEquipment] = useState<GymEquipment | null>(null);
  const [favorites, setFavorites] = useState(false);
  const { data: exercicios, isLoading } = useGymExercises({ query, muscle, equipment, favorites });
  const favoritar = useToggleFavorite();

  const musculos = useMemo(() => Object.keys(MUSCLE_LABEL) as GymMuscle[], []);
  const equipamentos = useMemo(() => Object.keys(EQUIPMENT_LABEL) as GymEquipment[], []);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-black tracking-tight">Exercícios</h1>

      <label className="flex items-center gap-2 rounded-xl border border-[rgb(var(--border))] surface px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome, músculo ou equipamento..."
          className="w-full bg-transparent text-sm outline-none"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Limpar busca">
            <X className="h-4 w-4 text-muted" />
          </button>
        )}
      </label>

      <div className="space-y-2">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Chip active={favorites} onClick={() => setFavorites((f) => !f)}>
            <Star className={cn("h-3 w-3", favorites && "fill-current")} />
            Favoritos
          </Chip>
          <Chip active={muscle === null && !favorites} onClick={() => { setMuscle(null); setFavorites(false); }}>
            Todos
          </Chip>
          {musculos.map((m) => (
            <Chip key={m} active={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
              {MUSCLE_LABEL[m]}
            </Chip>
          ))}
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {equipamentos.map((eq) => (
            <Chip key={eq} active={equipment === eq} onClick={() => setEquipment(equipment === eq ? null : eq)} small>
              {EQUIPMENT_LABEL[eq]}
            </Chip>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : exercicios?.length === 0 ? (
        <EmptyState
          icon={<Search className="h-7 w-7" />}
          title="Nada encontrado"
          description="Tente outro termo ou limpe os filtros — a busca também aceita músculo e equipamento."
        />
      ) : (
        <>
          <p className="text-xs text-muted">{exercicios?.length} exercícios</p>
          <div className="space-y-2">
            {exercicios?.map((ex) => (
              <Card key={ex.id}>
                <CardContent className="flex items-center gap-3 py-3">
                  <Link to={`/academia/exercicios/${ex.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{ex.name}</p>
                    <p className="text-xs text-muted">
                      {MUSCLE_LABEL[ex.primaryMuscle]} · {EQUIPMENT_LABEL[ex.equipment]}
                      {ex.timesPerformed > 0 && ` · ${ex.timesPerformed} séries feitas`}
                    </p>
                  </Link>
                  <button
                    onClick={() => favoritar.mutate(ex.id)}
                    aria-label={ex.favorite ? `Desfavoritar ${ex.name}` : `Favoritar ${ex.name}`}
                    aria-pressed={ex.favorite}
                    className="shrink-0 rounded-lg p-2 transition-colors hover:surface-2"
                  >
                    <Star className={cn("h-4 w-4", ex.favorite ? cn("fill-current", GYM.text) : "text-muted")} />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ active, onClick, children, small }: { active: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full font-semibold transition-colors",
        small ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        active ? cn("text-white", GYM.solid) : "surface-2 text-muted hover:brightness-95",
      )}
    >
      {children}
    </button>
  );
}
