import { useEffect, useRef, useState } from "react";
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
  Users,
  Landmark,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  type LucideIcon,
} from "lucide-react";
import { useThemeStore } from "@/store/theme";
import { useAuthStore } from "@/store/auth";
import { QuotesTicker } from "@/app/QuotesTicker";
import { HomeDashboardSection } from "@/app/HomeDashboardSection";
import { PrivacyToggle } from "@/components/PrivacyToggle";

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
    description: "Cartões, compras, parcelas e assinaturas.",
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
    to: "/financiamentos",
    title: "Financiamentos",
    description: "Carro, moto, casa — parcelas, valor do bem e patrimônio.",
    icon: Landmark,
    color: "bg-rose-500",
  },
  {
    to: "/mercado",
    title: "Mercado",
    description: "Escaneie a nota do supermercado e acompanhe preço e imposto.",
    icon: ShoppingCart,
    color: "bg-sky-500",
  },
  {
    to: "/academia",
    title: "Academia",
    description: "Fichas de treino, execução com cronômetro, evolução e recordes.",
    icon: Dumbbell,
    color: "bg-lime-500",
  },
  {
    to: "/crm",
    title: "CRM",
    description: "Clientes, assinaturas, revendedores e créditos dos dois serviços.",
    icon: Users,
    color: "bg-indigo-500",
  },
];

function AppCarousel() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [temOverflow, setTemOverflow] = useState(false);

  // Com os cards pequenos as cinco ferramentas cabem numa linha só em tela grande, e aí as setas
  // não rolam nada — botão que não faz nada é pior que botão nenhum. Medido em vez de decidido por
  // breakpoint porque o que importa é quantos cards existem, e isso muda a cada ferramenta nova.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const medir = () => setTemOverflow(el.scrollWidth > el.clientWidth + 1);
    medir();
    const observer = new ResizeObserver(medir);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
            className="shrink-0 snap-center"
          >
            {/* A descrição sai do card e vira title: sem ela cabem cinco ferramentas na tela em vez
                de uma e meia, e quem não reconhecer o ícone ainda alcança o texto no hover. */}
            <Link
              to={app.to}
              title={app.description}
              className="group flex aspect-square w-28 flex-col items-center justify-center gap-2.5 rounded-2xl border border-[rgb(var(--border))] surface p-3 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated sm:w-32"
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-white sm:h-12 sm:w-12 ${app.color}`}>
                <app.icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              {/* Duas linhas reservadas sempre: "Contas da Casa" quebra e os outros não, e sem a
                  altura fixa o ícone dele sobe uns 10px e desalinha da fileira. */}
              <p className="flex h-8 items-start justify-center text-center text-xs font-semibold leading-tight sm:text-sm">{app.title}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      {temOverflow && (
        <>
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
        </>
      )}
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
          <PrivacyToggle />
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
