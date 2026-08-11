import { NavLink, Outlet } from "react-router-dom";
import { ArrowLeft, LayoutDashboard, Landmark, ListChecks, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { FinancingsMobileNav } from "./FinancingsMobileNav";

export const FINANCINGS_NAV = [
  { to: "/financiamentos", label: "Visão Geral", icon: LayoutDashboard, end: true },
  { to: "/financiamentos/bens", label: "Bens", icon: Wallet },
  { to: "/financiamentos/parcelas", label: "Parcelas", icon: ListChecks },
];

/**
 * Financiamento saiu de dentro do Parcelas e virou módulo próprio. O motivo é que ele deixou de
 * ser "mais um tipo de parcela": tem bem com valor de mercado, patrimônio, histórico de avaliação
 * e cotação de quitação — nada disso cabe numa tela de cartão de crédito.
 */
export function FinancingsLayout() {
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500 text-white">
                <Landmark className="h-4 w-4" />
              </div>
              <p className="text-sm font-bold leading-tight">Financiamentos</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {FINANCINGS_NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      : "text-muted hover:surface-2 hover:text-[rgb(var(--text))]",
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

      <FinancingsMobileNav />
    </div>
  );
}
