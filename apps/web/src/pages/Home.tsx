import { Link } from "react-router-dom";
import { LogOut, Moon, Settings, Sun, Wrench, CreditCard, LineChart, Clock, type LucideIcon } from "lucide-react";
import { useThemeStore } from "@/store/theme";
import { useAuthStore } from "@/store/auth";
import { QuotesTicker } from "@/app/QuotesTicker";

interface AppCard {
  to: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

/** The home hub's app picker — add an entry here for each new tool as it's built. */
const APPS: AppCard[] = [
  {
    to: "/parcelas",
    title: "Parcelas",
    description: "Cartões, compras, parcelas, assinaturas e financiamentos.",
    icon: CreditCard,
    color: "bg-accent-500",
  },
  {
    to: "/investimentos",
    title: "Investimentos",
    description: "Ações, FIIs, criptomoedas, renda fixa e proventos.",
    icon: LineChart,
    color: "bg-emerald-500",
  },
  {
    to: "/horas",
    title: "Horas",
    description: "Controle de horas, faturamento e valor real da sua hora.",
    icon: Clock,
    color: "bg-violet-500",
  },
];

export default function Home() {
  const { mode, toggle } = useThemeStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="flex min-h-screen flex-col bg-[rgb(var(--bg))]">
      <header className="flex items-center justify-between border-b border-[rgb(var(--border))] px-4 pb-4 pt-[calc(1rem_+_env(safe-area-inset-top))] md:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-500 text-white">
            <Wrench className="h-5 w-5" />
          </div>
          <p className="text-sm font-bold leading-tight">Ferramentas do Mauro</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:surface-2"
            aria-label="Alternar tema"
          >
            {mode === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <Link
            to="/configuracoes"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:surface-2"
            aria-label="Configurações gerais"
            title="Configurações gerais"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <button
            onClick={logout}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:surface-2"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <QuotesTicker />

      <main className="flex flex-1 flex-col items-center px-4 py-12 md:py-20">
        <div className="w-full max-w-3xl">
          <h1 className="text-2xl font-bold">Olá{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
          <p className="mt-1 text-sm text-muted">Escolha uma ferramenta pra continuar.</p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {APPS.map((app) => (
              <Link
                key={app.to}
                to={app.to}
                className="group flex flex-col gap-4 rounded-2xl border border-[rgb(var(--border))] surface p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-white ${app.color}`}>
                  <app.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">{app.title}</p>
                  <p className="mt-1 text-sm text-muted">{app.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
