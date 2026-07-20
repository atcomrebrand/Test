import { NavLink, Outlet } from "react-router-dom";
import { ArrowLeft, LayoutDashboard, Compass, LineChart, PiggyBank, History, Newspaper, CalendarDays, Upload, ClipboardList } from "lucide-react";
import { cn } from "@/lib/cn";
import { InvestmentsMobileNav } from "./InvestmentsMobileNav";

const INVESTMENT_NAV = [
  { to: "/investimentos", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/investimentos/explorar", label: "Explorar", icon: Compass },
  { to: "/investimentos/carteira", label: "Carteira", icon: LineChart },
  { to: "/investimentos/renda-fixa", label: "Renda Fixa", icon: PiggyBank },
  { to: "/investimentos/proventos", label: "Proventos", icon: CalendarDays },
  { to: "/investimentos/noticias", label: "Notícias", icon: Newspaper },
  { to: "/investimentos/historico", label: "Histórico", icon: History },
  { to: "/investimentos/importar", label: "Importar B3", icon: Upload },
  { to: "/investimentos/lancamentos", label: "Lançamentos", icon: ClipboardList },
];

export function InvestmentsLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="surface sticky top-0 z-20 border-b border-[rgb(var(--border))]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <NavLink
              to="/"
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:surface-2 hover:text-[rgb(var(--text))]"
            >
              <ArrowLeft className="h-4 w-4" />
              Parcelas
            </NavLink>
            <div className="h-5 w-px bg-[rgb(var(--border))]" />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
                <LineChart className="h-4 w-4" />
              </div>
              <p className="text-sm font-bold leading-tight">Investimentos</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {INVESTMENT_NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "text-muted hover:surface-2 hover:text-[rgb(var(--text))]",
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

      <main className="flex-1 px-4 pb-24 pt-5 md:px-6 md:pb-10">
        <Outlet />
      </main>

      <InvestmentsMobileNav />
    </div>
  );
}
