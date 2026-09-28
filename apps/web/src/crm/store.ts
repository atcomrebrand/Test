import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Portfólio selecionado globalmente (§2).
 *
 * `null` = "Todos os portfólios". Guardar em zustand persistido em vez de na URL porque a seleção
 * atravessa todas as telas do módulo e precisa sobreviver ao refresh — sair do Dashboard pra
 * Clientes não pode voltar pro serviço errado, que é exatamente o risco que o briefing levanta.
 */
interface CrmState {
  portfolioId: string | null;
  setPortfolioId: (id: string | null) => void;
}

export const useCrmStore = create<CrmState>()(
  persist(
    (set) => ({
      portfolioId: null,
      setPortfolioId: (portfolioId) => set({ portfolioId }),
    }),
    { name: "crm-portfolio" },
  ),
);
