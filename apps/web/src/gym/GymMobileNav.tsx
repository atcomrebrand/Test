import { ModuleMobileNav } from "@/components/ModuleMobileNav";
import { GYM_NAV } from "./GymLayout";

/** As cinco áreas cabem na barra: nenhuma cai no "Mais". */
export function GymMobileNav() {
  return (
    <ModuleMobileNav
      items={GYM_NAV}
      primaryPaths={GYM_NAV.map((i) => i.to)}
      activeClass="text-lime-500"
      sheetActiveClass="bg-lime-500/10 text-lime-600 dark:text-lime-400"
    />
  );
}
