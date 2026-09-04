import { ModuleMobileNav } from "@/components/ModuleMobileNav";
import { INVESTMENT_NAV } from "./InvestmentsLayout";

/** Dashboard, Explorar e Carteira são o caminho diário; proventos, notícias e importação entram
 *  no "Mais". */
const PRIMARY = ["/investimentos", "/investimentos/explorar", "/investimentos/carteira"];

export function InvestmentsMobileNav() {
  return (
    <ModuleMobileNav
      items={INVESTMENT_NAV}
      primaryPaths={PRIMARY}
      activeClass="text-emerald-500"
      sheetActiveClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    />
  );
}
