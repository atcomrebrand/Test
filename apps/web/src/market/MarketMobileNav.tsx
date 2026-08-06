import { NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";
import { MARKET_NAV } from "./MarketLayout";

/** All 4 destinations fit in the bar directly, same as Casa — no "Mais" overflow needed. */
export function MarketMobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[rgb(var(--border))] surface px-2 pb-[calc(0.5rem_+_env(safe-area-inset-bottom))] pt-2 md:hidden">
      {MARKET_NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn("flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium", isActive ? "text-sky-500" : "text-muted")
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
