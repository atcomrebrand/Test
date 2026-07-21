import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  MoreHorizontal,
  Timer,
  LayoutDashboard,
  Briefcase,
  FolderKanban,
  Wallet,
  CalendarDays,
  FileBarChart,
  TrendingUp,
  History,
  Search,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/ui/Modal";

const PRIMARY_ITEMS = [
  { to: "/horas", label: "Modo Foco", icon: Timer, end: true },
  { to: "/horas/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/horas/trabalhos", label: "Trabalhos", icon: Briefcase },
];

const MORE_ITEMS: { to: string; label: string; icon: typeof Timer }[] = [
  { to: "/horas/projetos", label: "Projetos", icon: FolderKanban },
  { to: "/horas/entradas", label: "Entradas", icon: Wallet },
  { to: "/horas/calendario", label: "Calendário", icon: CalendarDays },
  { to: "/horas/relatorios", label: "Relatórios", icon: FileBarChart },
  { to: "/horas/estatisticas", label: "Estatísticas", icon: TrendingUp },
  { to: "/horas/historico", label: "Histórico", icon: History },
  { to: "/horas/busca", label: "Busca", icon: Search },
];

/** Same primary-items + "Mais" pattern as InvestmentsMobileNav, so Horas feels like part of the
 *  same product on mobile — the "Mais" button only renders once there's something to put in it. */
export function TrackingMobileNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const isMoreActive = MORE_ITEMS.some((item) => item.to === location.pathname);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[rgb(var(--border))] surface px-2 pb-[calc(0.5rem_+_env(safe-area-inset-bottom))] pt-2 md:hidden">
        {PRIMARY_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium",
                isActive ? "text-violet-500" : "text-muted",
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
        {MORE_ITEMS.length > 0 && (
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium",
              isMoreActive ? "text-violet-500" : "text-muted",
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            Mais
          </button>
        )}
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Mais opções">
        <div className="flex flex-col gap-1">
          {MORE_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                  isActive ? "bg-violet-500/10 text-violet-600 dark:text-violet-400" : "hover:surface-2",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </div>
      </Modal>
    </>
  );
}
