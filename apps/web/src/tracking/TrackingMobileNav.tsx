import { ModuleMobileNav } from "@/components/ModuleMobileNav";
import { TRACKING_NAV } from "./TrackingLayout";

/** Modo Foco é o que se abre pra bater ponto; o resto do dia a dia acompanha, e relatórios,
 *  estatísticas e busca ficam no "Mais". */
const PRIMARY = ["/horas", "/horas/dashboard", "/horas/trabalhos", "/horas/calendario"];

export function TrackingMobileNav() {
  return (
    <ModuleMobileNav
      items={TRACKING_NAV}
      primaryPaths={PRIMARY}
      activeClass="text-violet-500"
      sheetActiveClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
    />
  );
}
