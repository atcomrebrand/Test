import { ModuleMobileNav } from "@/components/ModuleMobileNav";
import { CRM_NAV } from "./CrmLayout";

/**
 * As quatro operações de todo dia na barra (§59, §60): ver o dashboard, ver quem vence, abrir um
 * cliente, abrir um revendedor. O resto entra no "Mais" — dez destinos não cabem numa barra, e
 * espremer tudo tornaria os quatro que importam mais difíceis de acertar com o dedo.
 */
const PRIMARY = ["/crm", "/crm/vencimentos", "/crm/clientes", "/crm/revendedores"];

const SHORT: Record<string, string> = {
  "/crm": "Início",
  "/crm/vencimentos": "Vencem",
  "/crm/revendedores": "Revenda",
};

export function CrmMobileNav() {
  return (
    <ModuleMobileNav
      items={CRM_NAV.map((i) => ({ ...i, shortLabel: SHORT[i.to] }))}
      primaryPaths={PRIMARY}
      activeClass="text-indigo-500"
      sheetActiveClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
    />
  );
}
