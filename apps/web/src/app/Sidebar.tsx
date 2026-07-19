import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  CreditCard,
  ShoppingBag,
  ListChecks,
  CalendarDays,
  History,
  Tags,
  BarChart3,
  Settings,
  Trash2,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/cards", label: "Cartões", icon: CreditCard },
  { to: "/purchases", label: "Compras", icon: ShoppingBag },
  { to: "/installments", label: "Parcelas", icon: ListChecks },
  { to: "/calendar", label: "Calendário", icon: CalendarDays },
  { to: "/timeline", label: "Linha do Tempo", icon: History },
  { to: "/categories", label: "Categorias", icon: Tags },
  { to: "/statistics", label: "Estatísticas", icon: BarChart3 },
  { to: "/trash", label: "Lixeira", icon: Trash2 },
  { to: "/settings", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[rgb(var(--border))] surface px-3 py-5 md:flex">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-500 text-white">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">Parcelas</p>
          <p className="text-xs text-muted leading-tight">Gestão financeira</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent-500/10 text-accent-600 dark:text-accent-300"
                  : "text-muted hover:surface-2 hover:text-[rgb(var(--text))]",
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="rounded-xl surface-2 p-3 text-xs text-muted">
        <kbd className="rounded bg-[rgb(var(--surface))] px-1.5 py-0.5 font-mono">⌘K</kbd> para busca rápida
      </div>
    </aside>
  );
}
