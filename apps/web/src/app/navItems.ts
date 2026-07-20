import {
  LayoutDashboard,
  CreditCard,
  ShoppingBag,
  ListChecks,
  CalendarDays,
  History,
  Tags,
  BarChart3,
  Settings,
  Trash2,
  Landmark,
  Repeat,
  LineChart,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/cards", label: "Cartões", icon: CreditCard },
  { to: "/purchases", label: "Compras", icon: ShoppingBag },
  { to: "/installments", label: "Parcelas", icon: ListChecks },
  { to: "/subscriptions", label: "Assinaturas", icon: Repeat },
  { to: "/financing", label: "Financiamentos", icon: Landmark },
  { to: "/investimentos", label: "Investimentos", icon: LineChart },
  { to: "/calendar", label: "Calendário", icon: CalendarDays },
  { to: "/timeline", label: "Linha do Tempo", icon: History },
  { to: "/categories", label: "Categorias", icon: Tags },
  { to: "/statistics", label: "Estatísticas", icon: BarChart3 },
  { to: "/trash", label: "Lixeira", icon: Trash2 },
  { to: "/settings", label: "Configurações", icon: Settings },
];

/** Primary destinations pinned to the mobile bottom bar; everything else lives behind "Mais". */
export const MOBILE_PRIMARY_PATHS = ["/", "/cards", "/purchases", "/calendar"];
