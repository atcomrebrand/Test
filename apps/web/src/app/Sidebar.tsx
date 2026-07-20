import { Link, NavLink } from "react-router-dom";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "./navItems";

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[rgb(var(--border))] surface px-3 py-5 md:flex">
      <Link to="/" className="mb-6 flex items-center gap-2 rounded-xl px-2 py-1 transition-colors hover:surface-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-500 text-white">
          <Wallet className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">Parcelas</p>
          <p className="text-xs text-muted leading-tight">Ferramentas do Mauro</p>
        </div>
      </Link>

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
