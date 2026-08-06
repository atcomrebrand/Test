import { NavLink, Outlet } from "react-router-dom";
import { ArrowLeft, LayoutDashboard, Package, QrCode, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/cn";
import { MarketMobileNav } from "./MarketMobileNav";

export const MARKET_NAV = [
  { to: "/mercado", label: "Resumo", icon: LayoutDashboard, end: true },
  { to: "/mercado/importar", label: "Importar", icon: QrCode },
  { to: "/mercado/compras", label: "Compras", icon: ShoppingCart },
  { to: "/mercado/produtos", label: "Produtos", icon: Package },
];

export function MarketLayout() {
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-white">
                <ShoppingCart className="h-4 w-4" />
              </div>
              <p className="text-sm font-bold leading-tight">Mercado</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {MARKET_NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive ? "bg-sky-500/10 text-sky-600 dark:text-sky-400" : "text-muted hover:surface-2 hover:text-[rgb(var(--text))]",
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

      <MarketMobileNav />
    </div>
  );
}
