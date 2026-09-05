import { ComponentType, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MoreHorizontal, X } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export interface ModuleNavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  /** Rótulo curto pra barra inferior, quando o do menu não cabe em ~7 caracteres. */
  shortLabel?: string;
}

interface ModuleMobileNavProps {
  /** Todos os destinos do módulo, na ordem do menu de desktop. */
  items: ModuleNavItem[];
  /** Quais aparecem direto na barra. O resto cai no "Mais". */
  primaryPaths: string[];
  /**
   * Classe Tailwind completa da cor do módulo. Precisa ser literal — classe montada por
   * interpolação some no purge do Tailwind, que é justamente o bug silencioso que faria a barra
   * ficar cinza em produção e certa em dev.
   */
  activeClass: string;
  /** Cor do item ativo dentro da folha, com fundo. */
  sheetActiveClass: string;
}

/**
 * Barra inferior dos módulos, com a folha de "Mais" em vez de um modal centralizado.
 *
 * A folha sobe do rodapé porque é de lá que o dedo vem: um diálogo no meio da tela obriga a mão a
 * atravessar o aparelho pra escolher e voltar. A grade de três colunas também troca uma lista
 * rolável por uma tela só — com nove destinos, a lista vertical exigia rolagem justamente no menu
 * que existe pra ser rápido.
 *
 * Um componente só pra todos os módulos: eles diferem em cor e em quais destinos são primários, e
 * nada disso justifica sete implementações que divergem com o tempo.
 */
export function ModuleMobileNav({ items, primaryPaths, activeClass, sheetActiveClass }: ModuleMobileNavProps) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const primary = items.filter((i) => primaryPaths.includes(i.to));
  const secondary = items.filter((i) => !primaryPaths.includes(i.to));

  // "Mais" fica destacado quando a tela atual mora dentro dele — senão a barra inteira parece
  // apagada e não dá pra saber onde se está.
  const moreActive = secondary.some((i) => i.to === location.pathname);

  return (
    <>
      {createPortal(
        <AnimatePresence>
          {open && (
            <div className="fixed inset-0 z-40 md:hidden print:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpen(false)}
                className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
              />
              <motion.div
                /* Mola pra entrar, tween curto pra sair: a mola de saída levava ~800ms pra assentar,
                   e fechar um menu tem que ser imediato — a entrada é que ganha personalidade.
                   Precisa ser variante: transição por estado só é respeitada assim, e um `exit`
                   dentro de `transition` é silenciosamente ignorado. */
                variants={{
                  hidden: { y: "100%", transition: { type: "tween", duration: 0.18, ease: "easeIn" } },
                  visible: { y: 0, transition: { type: "spring", damping: 30, stiffness: 320 } },
                }}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="surface absolute inset-x-0 bottom-0 rounded-t-2xl p-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] shadow-2xl"
              >
                {/* A alça é a affordance de "isso arrasta pra baixo" — sem ela a folha parece um
                    painel preso e a pessoa procura um X que poderia não existir. */}
                <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[rgb(var(--border))]" />

                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">Mais</p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Fechar"
                    className="rounded-lg p-1 text-muted transition-colors hover:surface-2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {secondary.map(({ to, label, icon: Icon, end }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={end}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center text-[11px] font-medium leading-tight transition-colors",
                          isActive ? sheetActiveClass : "surface-2 hover:brightness-95 dark:hover:brightness-110",
                        )
                      }
                    >
                      <Icon className={cn("h-5 w-5", activeClass)} />
                      {label}
                    </NavLink>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}

      {/* Fora da impressão: navegação não vai pro papel. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around print:hidden border-t border-[rgb(var(--border))] surface px-2 pb-[calc(0.5rem_+_env(safe-area-inset-bottom))] pt-2 md:hidden">
        {primary.map(({ to, label, shortLabel, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium",
                isActive ? activeClass : "text-muted",
              )
            }
          >
            <Icon className="h-5 w-5" />
            {shortLabel ?? label}
          </NavLink>
        ))}

        {/* Só existe quando sobra alguma coisa: um "Mais" que abre uma folha vazia é pior que
            nenhum botão. */}
        {secondary.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium",
              moreActive ? activeClass : "text-muted",
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            Mais
          </button>
        )}
      </nav>
    </>
  );
}
