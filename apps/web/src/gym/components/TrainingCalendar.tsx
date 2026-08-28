import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Skeleton } from "@/components/ui/Skeleton";
import { MONTH_NAMES } from "@/lib/format";
import { usePrivacyStore } from "@/store/privacy";
import { useGymCalendar } from "../api";
import { formatVolume, GYM } from "../theme";

const SIGLAS = ["D", "S", "T", "Q", "Q", "S", "S"];

/**
 * Calendário do mês, marcando os dias treinados.
 *
 * O que ele responde é "como foi minha frequência", e pra isso o dia SEM treino precisa ser tão
 * visível quanto o com: um calendário que só desenha os treinos vira uma constelação solta, e a
 * pergunta é justamente sobre os buracos. Por isso todo dia do mês aparece, e a diferença está no
 * preenchimento.
 *
 * Dia futuro não é "dia sem treino" — ainda não aconteceu. Ele fica esmaecido pra não ser lido
 * como falta.
 */
export function TrainingCalendar() {
  const hoje = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => ({ year: hoje.getFullYear(), month: hoje.getMonth() + 1 }));
  const { data, isLoading } = useGymCalendar(cursor.year, cursor.month);
  const hidden = usePrivacyStore((s) => s.hidden);

  const hojeIso = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())).toISOString().slice(0, 10);
  const porDia = useMemo(() => new Map((data?.days ?? []).map((d) => [d.date, d])), [data]);

  // Dias do mês, precedidos dos vazios até o primeiro domingo — é o que alinha a coluna certa.
  const celulas = useMemo(() => {
    const primeiro = new Date(Date.UTC(cursor.year, cursor.month - 1, 1));
    const diasNoMes = new Date(Date.UTC(cursor.year, cursor.month, 0)).getUTCDate();
    const vazias = primeiro.getUTCDay();
    return [
      ...Array.from({ length: vazias }, () => null),
      ...Array.from({ length: diasNoMes }, (_, i) => {
        const d = new Date(Date.UTC(cursor.year, cursor.month - 1, i + 1));
        return { dia: i + 1, iso: d.toISOString().slice(0, 10) };
      }),
    ];
  }, [cursor]);

  function mover(delta: number) {
    setCursor((c) => {
      const d = new Date(Date.UTC(c.year, c.month - 1 + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
    });
  }

  const treinados = data?.days.length ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => mover(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:surface-2"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-bold capitalize">
          {MONTH_NAMES[cursor.month - 1]} {cursor.year}
        </p>
        <button
          onClick={() => mover(1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:surface-2"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <Skeleton className="mt-3 h-56" />
      ) : (
        <>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center">
            {SIGLAS.map((s, i) => (
              <span key={i} className="text-[11px] font-semibold text-muted">
                {s}
              </span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {celulas.map((c, i) => {
              if (!c) return <span key={`v${i}`} />;
              const dados = porDia.get(c.iso);
              const treinou = !!dados;
              const futuro = c.iso > hojeIso;
              const ehHoje = c.iso === hojeIso;
              return (
                <span
                  key={c.iso}
                  title={
                    treinou
                      ? `${dados!.names.join(", ")} · ${formatVolume(dados!.volume, hidden)}`
                      : futuro
                        ? undefined
                        : "Sem treino"
                  }
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-lg text-xs font-semibold transition-colors",
                    treinou
                      ? cn("text-white", GYM.solid)
                      : futuro
                        ? "text-muted/40"
                        : "surface-2 text-muted",
                    ehHoje && !treinou && "ring-2 ring-sky-500",
                  )}
                >
                  {c.dia}
                </span>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className={cn("h-3 w-3 rounded", GYM.solid)} />
                Treinou
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded surface-2" />
                Não treinou
              </span>
            </span>
            <span className="font-semibold">
              {treinados} {treinados === 1 ? "dia" : "dias"} no mês
            </span>
          </div>
        </>
      )}
    </div>
  );
}
