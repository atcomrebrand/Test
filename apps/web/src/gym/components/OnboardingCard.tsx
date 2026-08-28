import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Dumbbell } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { useUpdateGymProfile } from "../api";
import { GymLevel, GymObjective } from "../types";
import { GYM, LEVEL_LABEL, OBJECTIVE_LABEL } from "../theme";

const OBJETIVOS: GymObjective[] = ["HIPERTROFIA", "FORCA", "EMAGRECIMENTO", "CONDICIONAMENTO", "MANUTENCAO"];
const NIVEIS: GymLevel[] = ["INICIANTE", "INTERMEDIARIO", "AVANCADO"];

/**
 * Onboarding (§34).
 *
 * Cinco perguntas, uma por vez, todas com resposta em um toque — nenhuma exige digitar. O nome não
 * é perguntado: a conta já tem um, e pedir de novo o que o app sabe é o tipo de atrito que faz
 * alguém desistir na primeira tela.
 *
 * Nada aqui é obrigatório pra usar o módulo: os valores têm padrão e são todos editáveis no Perfil
 * depois. O onboarding define o ponto de partida, não uma configuração definitiva.
 */
export function OnboardingCard() {
  const salvar = useUpdateGymProfile();
  const [etapa, setEtapa] = useState(0);
  const [objective, setObjective] = useState<GymObjective>("HIPERTROFIA");
  const [level, setLevel] = useState<GymLevel>("INICIANTE");
  const [weeklyTarget, setWeeklyTarget] = useState(4);
  const [sessionMinutes, setSessionMinutes] = useState(60);
  const [defaultRestSeconds, setDefaultRestSeconds] = useState(90);

  const etapas = [
    {
      titulo: "Qual seu objetivo?",
      opcoes: OBJETIVOS.map((o) => ({ value: o, label: OBJECTIVE_LABEL[o] })),
      valor: objective,
      escolher: (v: string) => setObjective(v as GymObjective),
    },
    {
      titulo: "Qual seu nível?",
      opcoes: NIVEIS.map((n) => ({ value: n, label: LEVEL_LABEL[n] })),
      valor: level,
      escolher: (v: string) => setLevel(v as GymLevel),
    },
    {
      titulo: "Quantos dias por semana você treina?",
      opcoes: [2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: `${n}x` })),
      valor: String(weeklyTarget),
      escolher: (v: string) => setWeeklyTarget(Number(v)),
    },
    {
      titulo: "Quanto tempo você costuma ter?",
      opcoes: [30, 45, 60, 75, 90, 120].map((n) => ({ value: String(n), label: `${n} min` })),
      valor: String(sessionMinutes),
      escolher: (v: string) => setSessionMinutes(Number(v)),
    },
    {
      titulo: "Descanso padrão entre séries",
      // Vira o padrão de todo exercício novo numa ficha (§33), e continua editável por exercício.
      opcoes: [45, 60, 75, 90, 120, 150].map((n) => ({ value: String(n), label: `${n}s` })),
      valor: String(defaultRestSeconds),
      escolher: (v: string) => setDefaultRestSeconds(Number(v)),
    },
  ];

  const atual = etapas[etapa];
  const ultima = etapa === etapas.length - 1;

  return (
    <div className="mx-auto max-w-lg">
      <div className={cn("rounded-3xl border p-6", GYM.border, GYM.soft)}>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl text-white", GYM.solid)}>
          <Dumbbell className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-black tracking-tight">Bora começar</h1>
        <p className="text-sm text-muted">Cinco toques e seu diário de treino está pronto.</p>

        <div className="mt-5 flex gap-1.5">
          {etapas.map((_, i) => (
            <div key={i} className={cn("h-1 flex-1 rounded-full", i <= etapa ? "bg-sky-500" : "surface-2")} />
          ))}
        </div>

        <motion.div key={etapa} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="mt-6">
          <p className="text-base font-bold">{atual.titulo}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {atual.opcoes.map((o) => (
              <button
                key={o.value}
                onClick={() => atual.escolher(o.value)}
                className={cn(
                  "rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors",
                  atual.valor === o.value
                    ? cn("border-transparent text-white", GYM.solid)
                    : "border-[rgb(var(--border))] surface hover:surface-2",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </motion.div>

        <div className="mt-6 flex gap-2">
          {etapa > 0 && (
            <Button variant="ghost" onClick={() => setEtapa((e) => e - 1)}>
              Voltar
            </Button>
          )}
          <Button
            className="flex-1"
            loading={salvar.isPending}
            onClick={() => {
              if (!ultima) return setEtapa((e) => e + 1);
              salvar.mutate({ objective, level, weeklyTarget, sessionMinutes, defaultRestSeconds, onboarded: true });
            }}
          >
            {ultima ? (
              <>
                <Check className="h-4 w-4" />
                Criar perfil
              </>
            ) : (
              <>
                Continuar
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
