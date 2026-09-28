import { NavLink, Outlet, useLocation } from "react-router-dom";
import { ArrowLeft, Dumbbell, Home, ListChecks, TrendingUp, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { GymMobileNav } from "./GymMobileNav";
import { ActiveSessionBar } from "./components/ActiveSessionBar";
import { useGymSync } from "./useGymSync";
import { GYM } from "./theme";

/** As cinco áreas do §4. Exatamente cinco — cabem na barra sem precisar do "Mais". */
export const GYM_NAV = [
  { to: "/academia", label: "Início", icon: Home, end: true },
  { to: "/academia/treinos", label: "Treinos", icon: ListChecks },
  { to: "/academia/exercicios", label: "Exercícios", icon: Dumbbell, shortLabel: "Exerc." },
  { to: "/academia/progresso", label: "Progresso", icon: TrendingUp, shortLabel: "Progr." },
  { to: "/academia/perfil", label: "Perfil", icon: User },
];

export function GymLayout() {
  const location = useLocation();
  // A fila de subida é tentada em QUALQUER tela do módulo, não só na Home: quem terminou o treino
  // offline pode abrir o histórico antes de voltar pro início, e o treino tem que subir do mesmo
  // jeito. Idempotente por `clientId`, então tentar de vários lugares não duplica nada.
  useGymSync();
  // O modo treino é tela cheia: cabeçalho e barra inferior saem da frente (§19). A navegação
  // atrapalhando a execução é exatamente o que o §4 pede pra evitar.
  const executando = location.pathname.startsWith("/academia/executar");

  if (executando) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-50">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="surface sticky top-0 z-20 border-b border-[rgb(var(--border))] pt-[env(safe-area-inset-top)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <NavLink
              to="/"
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:surface-2 hover:text-[rgb(var(--text))]"
            >
              <ArrowLeft className="h-4 w-4" />
              Início
            </NavLink>
            <div className="h-5 w-px bg-[rgb(var(--border))]" />
            <div className="flex items-center gap-2">
              <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-neutral-900", GYM.solid)}>
                <Dumbbell className="h-4 w-4" />
              </div>
              <p className="text-sm font-bold leading-tight">Academia</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {GYM_NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive ? cn("bg-lime-500/10", GYM.text) : "text-muted hover:surface-2 hover:text-[rgb(var(--text))]",
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 px-4 pb-[calc(6rem_+_env(safe-area-inset-bottom))] pt-5 md:px-6 md:pb-10">
        <Outlet />
      </main>

      {/* Treino em andamento em qualquer tela do módulo: a volta pra execução é um toque. */}
      <ActiveSessionBar />
      <GymMobileNav />
    </div>
  );
}
