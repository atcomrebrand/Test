import { NavLink, Outlet } from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Timer,
  Briefcase,
  LayoutDashboard,
  ListChecks,
  Wallet,
  CalendarDays,
  FileBarChart,
  FileText,
  TrendingUp,
  History,
  Search,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { TrackingMobileNav } from "./TrackingMobileNav";
import { FloatingTimerBar } from "./components/FloatingTimerBar";
import { PrivacyToggle } from "@/components/PrivacyToggle";

export const TRACKING_NAV = [
  { to: "/horas", label: "Modo Foco", icon: Timer, end: true },
  { to: "/horas/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/horas/trabalhos", label: "Trabalhos", icon: Briefcase },
  { to: "/horas/sessoes", label: "Sessões", icon: ListChecks },
  { to: "/horas/entradas", label: "Entradas", icon: Wallet },
  { to: "/horas/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/horas/relatorios", label: "Relatórios", icon: FileBarChart },
  { to: "/horas/extrato", label: "Extrato", icon: FileText },
  { to: "/horas/estatisticas", label: "Estatísticas", icon: TrendingUp },
  { to: "/horas/historico", label: "Histórico", icon: History },
  { to: "/horas/busca", label: "Busca", icon: Search },
];

export function TrackingLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Fora da impressão: no papel do extrato só entra o documento. */}
      <header className="surface sticky top-0 z-20 border-b border-[rgb(var(--border))] pt-[env(safe-area-inset-top)] print:hidden">
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500 text-white">
                <Clock className="h-4 w-4" />
              </div>
              <p className="text-sm font-bold leading-tight">Horas</p>
            </div>
            <PrivacyToggle />
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {TRACKING_NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive ? "bg-violet-500/10 text-violet-600 dark:text-violet-400" : "text-muted hover:surface-2 hover:text-[rgb(var(--text))]",
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

      <TrackingMobileNav />
      <FloatingTimerBar />
    </div>
  );
}
