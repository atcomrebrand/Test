import { NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";
import { HOUSEHOLD_NAV } from "./HouseholdLayout";

/** All 5 destinations fit directly in the bar — no "Mais" overflow needed, unlike Horas/Parcelas
 *  which have far more sub-pages. */
export function HouseholdMobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[rgb(var(--border))] surface px-2 pb-[calc(0.5rem_+_env(safe-area-inset-bottom))] pt-2 md:hidden">
      {HOUSEHOLD_NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium",
              isActive ? "text-amber-500" : "text-muted",
            )
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
