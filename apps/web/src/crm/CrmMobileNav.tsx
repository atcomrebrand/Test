import { useState } from "react";
import { NavLink } from "react-router-dom";
import { CalendarClock, LayoutDashboard, MoreHorizontal, Store, Users, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { CRM_NAV } from "./CrmLayout";

/**
 * As quatro operações de todo dia na barra (§59, §60): ver o dashboard, ver quem vence, abrir um
 * cliente, abrir um revendedor. O resto entra no "Mais" — dez destinos não cabem numa barra, e
 * espremer tudo tornaria os quatro que importam mais difíceis de acertar com o dedo.
 */
const PRIMARY = [
  { to: "/crm", label: "Início", icon: LayoutDashboard, end: true },
  { to: "/crm/vencimentos", label: "Vencem", icon: CalendarClock },
  { to: "/crm/clientes", label: "Clientes", icon: Users },
  { to: "/crm/revendedores", label: "Revenda", icon: Store },
];

export function CrmMobileNav() {
  const [open, setOpen] = useState(false);
  const secondary = CRM_NAV.filter((item) => !PRIMARY.some((p) => p.to === item.to));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="surface absolute inset-x-0 bottom-0 rounded-t-2xl p-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))]">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Mais</p>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {secondary.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  className="surface-2 flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-[11px] font-medium"
                >
                  <Icon className="h-5 w-5 text-indigo-500" />
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-[rgb(var(--border))] surface px-2 pb-[calc(0.5rem_+_env(safe-area-inset-bottom))] pt-2 md:hidden">
        {PRIMARY.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium",
                isActive ? "text-indigo-500" : "text-muted",
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium text-muted"
        >
          <MoreHorizontal className="h-5 w-5" />
          Mais
        </button>
      </nav>
    </>
  );
}
