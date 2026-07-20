import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MoreHorizontal, LayoutDashboard, Compass, LineChart, PiggyBank, History, Newspaper } from "lucide-react";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/ui/Modal";

const PRIMARY_ITEMS = [
  { to: "/investimentos", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/investimentos/explorar", label: "Explorar", icon: Compass },
  { to: "/investimentos/carteira", label: "Carteira", icon: LineChart },
];

const MORE_ITEMS = [
  { to: "/investimentos/renda-fixa", label: "Renda Fixa", icon: PiggyBank },
  { to: "/investimentos/noticias", label: "Notícias", icon: Newspaper },
  { to: "/investimentos/historico", label: "Histórico", icon: History },
];

/** Same primary-items + "Mais" pattern as the main app's MobileNav, so the investments module
 *  feels like part of the same product on mobile instead of a bolted-on horizontal scroller. */
export function InvestmentsMobileNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const isMoreActive = MORE_ITEMS.some((item) => item.to === location.pathname);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[rgb(var(--border))] surface px-2 py-2 md:hidden">
        {PRIMARY_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium",
                isActive ? "text-emerald-500" : "text-muted",
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium",
            isMoreActive ? "text-emerald-500" : "text-muted",
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          Mais
        </button>
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
                  isActive ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "hover:surface-2",
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
