import { ModuleMobileNav } from "@/components/ModuleMobileNav";
import { PROFIT_NAV } from "./ProfitLayout";

/** As quatro telas cabem na barra, então não há "Mais": o módulo é enxuto de propósito. */
export function ProfitMobileNav() {
  return (
    <ModuleMobileNav
      items={PROFIT_NAV}
      primaryPaths={PROFIT_NAV.map((i) => i.to)}
      activeClass="text-teal-600 dark:text-teal-400"
      sheetActiveClass="bg-teal-500/10 text-teal-600 dark:text-teal-400"
    />
  );
}
