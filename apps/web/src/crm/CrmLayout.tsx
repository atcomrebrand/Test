import { NavLink, Outlet } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Settings,
  Store,
  Users,
  UserPlus,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { CrmMobileNav } from "./CrmMobileNav";
import { PortfolioSwitcher } from "./PortfolioSwitcher";

export const CRM_NAV = [
  { to: "/crm", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/crm/vencimentos", label: "Vencimentos", icon: CalendarClock },
  { to: "/crm/clientes", label: "Clientes", icon: Users },
  { to: "/crm/revendedores", label: "Revendedores", icon: Store },
  { to: "/crm/leads", label: "Leads", icon: UserPlus },
  { to: "/crm/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/crm/retencao", label: "Retenção", icon: LifeBuoy },
  { to: "/crm/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/crm/comunicacao", label: "Comunicação", icon: MessageSquare },
  { to: "/crm/configuracoes", label: "Configurações", icon: Settings },
];

export function CrmLayout() {
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white">
                <Users className="h-4 w-4" />
              </div>
              <p className="text-sm font-bold leading-tight">CRM</p>
            </div>
          </div>

          {/* O seletor fica no header, não dentro das páginas: ele vale pra todas elas, e escondê-lo
              numa tela só faria a pessoa perder de vista em qual serviço está olhando. */}
          <PortfolioSwitcher />
        </div>

        <nav className="hidden items-center gap-1 overflow-x-auto px-4 pb-2 md:flex md:px-6">
          {CRM_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                    : "text-muted hover:surface-2 hover:text-[rgb(var(--text))]",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 px-4 pb-[calc(6rem_+_env(safe-area-inset-bottom))] pt-5 md:px-6 md:pb-10">
        <Outlet />
      </main>

      <CrmMobileNav />
    </div>
  );
}
