import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LogOut,
  Moon,
  Settings,
  Sun,
  Wrench,
  CreditCard,
  LineChart,
  Clock,
  Home as HomeIcon,
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useThemeStore } from "@/store/theme";
import { useAuthStore } from "@/store/auth";
import { QuotesTicker } from "@/app/QuotesTicker";
import { HomeDashboardSection } from "@/app/HomeDashboardSection";

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
  {
    to: "/casa",
    title: "Contas da Casa",
    description: "Contas, cartões, entradas e quanto realmente sobra no mês.",
    icon: HomeIcon,
    color: "bg-amber-500",
  },
  {
    to: "/mercado",
    title: "Mercado",
    description: "Escaneie a nota do supermercado e acompanhe preço e imposto.",
    icon: ShoppingCart,
    color: "bg-sky-500",
  },
];

function AppCarousel() {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollByAmount(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {APPS.map((app, i) => (
          <motion.div
            key={app.to}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            className="w-[85%] shrink-0 snap-center sm:w-[46%] lg:w-[30%]"
          >
            <Link
              to={app.to}
              className="group flex h-full flex-col gap-4 rounded-2xl border border-[rgb(var(--border))] surface p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-white ${app.color}`}>
                <app.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">{app.title}</p>
                <p className="mt-1 text-sm text-muted">{app.description}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => scrollByAmount(-1)}
        className="absolute -left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[rgb(var(--border))] surface shadow-soft md:flex"
        aria-label="Anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => scrollByAmount(1)}
        className="absolute -right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[rgb(var(--border))] surface shadow-soft md:flex"
        aria-label="Próximo"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

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
        <div className="w-full max-w-6xl">
          <h1 className="text-2xl font-bold">Olá{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
          <p className="mt-1 text-sm text-muted">Escolha uma ferramenta pra continuar.</p>

          <div className="mt-8">
            <AppCarousel />
          </div>

          <HomeDashboardSection />
        </div>
      </main>
    </div>
  );
}
