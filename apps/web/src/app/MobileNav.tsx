import { NavLink } from "react-router-dom";
import { LayoutDashboard, CreditCard, ShoppingBag, CalendarDays, BarChart3 } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { to: "/", label: "Início", icon: LayoutDashboard, end: true },
  { to: "/cards", label: "Cartões", icon: CreditCard },
  { to: "/purchases", label: "Compras", icon: ShoppingBag },
  { to: "/calendar", label: "Calendário", icon: CalendarDays },
  { to: "/statistics", label: "Stats", icon: BarChart3 },
];

export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[rgb(var(--border))] surface px-2 py-2 md:hidden">
      {ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium",
              isActive ? "text-accent-500" : "text-muted",
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
