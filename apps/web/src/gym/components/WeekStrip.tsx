import { cn } from "@/lib/cn";
import { GYM } from "../theme";

const SIGLAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * "Treinos feitos na semana": sete círculos, Dom→Sáb.
 *
 * O corte é o mesmo da contagem do card ao lado (`startOfWeek`, domingo) — se fossem diferentes, um
 * treino de domingo apareceria marcado aqui e somado na semana passada, e a tela se contradiria um
 * dia por semana.
 *
 * O dia de HOJE tem anel próprio mesmo sem treino: sem isso, numa semana ainda vazia os sete
 * círculos ficam idênticos e a tirinha não diz onde a pessoa está.
 */
export function WeekStrip({ days, today }: { days: { date: string; sessions: number }[]; today: string }) {
  return (
    <div>
      <p className="text-center text-sm font-bold">Treinos feitos na semana</p>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const treinou = d.sessions > 0;
          const ehHoje = d.date === today;
          return (
            <div key={d.date} className="flex flex-col items-center gap-1.5">
              <span className={cn("text-xs", ehHoje ? "font-bold" : "text-muted")}>{SIGLAS[i]}</span>
              <span
                aria-label={`${SIGLAS[i]}: ${treinou ? `${d.sessions} treino(s)` : "sem treino"}`}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                  treinou
                    ? cn("border-transparent text-neutral-900", GYM.solid)
                    : ehHoje
                      ? cn("border-lime-500", GYM.text)
                      : "border-[rgb(var(--border))] text-transparent",
                )}
              >
                {/* Dois treinos no mesmo dia aparecem como "2": marcar só "treinou" esconderia o
                    segundo, e o card de cima já conta os dois. */}
                {treinou && d.sessions > 1 ? d.sessions : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
