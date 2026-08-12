import { ModuleMobileNav } from "@/components/ModuleMobileNav";
import { NAV_ITEMS, MOBILE_PRIMARY_PATHS } from "./navItems";

/** Parcelas usa o mesmo componente dos outros módulos — a barra é a mesma peça em todo o app. */
export function MobileNav() {
  return (
    <ModuleMobileNav
      items={NAV_ITEMS}
      primaryPaths={[...MOBILE_PRIMARY_PATHS]}
      activeClass="text-accent-500"
      sheetActiveClass="bg-accent-500/10 text-accent-600 dark:text-accent-300"
    />
  );
}
