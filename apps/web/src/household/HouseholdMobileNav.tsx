import { ModuleMobileNav } from "@/components/ModuleMobileNav";
import { HOUSEHOLD_NAV } from "./HouseholdLayout";

/** Os quatro do dia a dia na barra; Configurações cai no "Mais", como nos outros módulos. */
const PRIMARY = ["/casa", "/casa/contas", "/casa/cartoes", "/casa/entradas"];

export function HouseholdMobileNav() {
  return (
    <ModuleMobileNav
      items={HOUSEHOLD_NAV}
      primaryPaths={PRIMARY}
      activeClass="text-amber-500"
      sheetActiveClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
    />
  );
}
