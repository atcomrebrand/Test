import { ModuleMobileNav } from "@/components/ModuleMobileNav";
import { FINANCINGS_NAV } from "./FinancingsLayout";

/** Três destinos cabem na barra — sem "Mais", que só aparece quando há o que colocar dentro. */
export function FinancingsMobileNav() {
  return (
    <ModuleMobileNav
      items={FINANCINGS_NAV}
      primaryPaths={FINANCINGS_NAV.map((i) => i.to)}
      activeClass="text-rose-500"
      sheetActiveClass="bg-rose-500/10 text-rose-600 dark:text-rose-400"
    />
  );
}
