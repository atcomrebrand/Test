import { ModuleMobileNav } from "@/components/ModuleMobileNav";
import { MARKET_NAV } from "./MarketLayout";

/** Os quatro destinos cabem na barra — o "Mais" não é renderizado quando não sobra nada. */
export function MarketMobileNav() {
  return (
    <ModuleMobileNav
      items={MARKET_NAV}
      primaryPaths={MARKET_NAV.map((i) => i.to)}
      activeClass="text-sky-500"
      sheetActiveClass="bg-sky-500/10 text-sky-600 dark:text-sky-400"
    />
  );
}
