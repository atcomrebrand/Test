import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";
import { Modal } from "@/components/ui/Modal";
import { NAV_ITEMS, MOBILE_PRIMARY_PATHS } from "./navItems";

const primaryItems = NAV_ITEMS.filter((item) => MOBILE_PRIMARY_PATHS.includes(item.to));
const moreItems = NAV_ITEMS.filter((item) => !MOBILE_PRIMARY_PATHS.includes(item.to));

export function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const isMoreActive = moreItems.some((item) => item.to === location.pathname);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[rgb(var(--border))] surface px-2 py-2 md:hidden">
        {primaryItems.map(({ to, label, icon: Icon, end }) => (
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
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium",
            isMoreActive ? "text-accent-500" : "text-muted",
          )}
        >
          <MoreHorizontal className="h-5 w-5" />
          Mais
        </button>
      </nav>

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="Mais opções">
        <div className="flex flex-col gap-1">
          {moreItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                  isActive ? "bg-accent-500/10 text-accent-600 dark:text-accent-300" : "hover:surface-2",
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
