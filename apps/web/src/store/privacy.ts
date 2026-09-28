import { create } from "zustand";

interface PrivacyState {
  hidden: boolean;
  toggle: () => void;
  setHidden: (hidden: boolean) => void;
}

const KEY = "cc_privacy";

/** A classe no `<html>` é o que alcança o que não passa por `formatCurrency`: o eixo dos gráficos,
 *  que tem formatador próprio em cada um. Mesmo mecanismo do tema. */
function applyDom(hidden: boolean) {
  document.documentElement.classList.toggle("privacy", hidden);
}

// Lido do localStorage antes do React montar: começar visível e esconder no primeiro render
// mostraria os valores por um quadro — que é exatamente o que o modo existe pra impedir.
const initial = localStorage.getItem(KEY) === "1";
applyDom(initial);

/**
 * Modo privacidade: esconde todo valor em dinheiro sem esconder a aplicação.
 *
 * Fica **fora** do backend de propósito. É preferência do aparelho em que se está, não da conta:
 * ligar no celular pra mostrar o app pra alguém não pode ligar no computador de casa também. Por
 * isso localStorage, como o tema.
 *
 * Não é segurança — os números continuam chegando na resposta da API, e quem abrir o DevTools os
 * vê. Serve pra plateia, não pra invasor; quem quer tranca de verdade usa o bloqueio por Face ID.
 */
export const usePrivacyStore = create<PrivacyState>((set, get) => ({
  hidden: initial,
  toggle: () => get().setHidden(!get().hidden),
  setHidden: (hidden) => {
    localStorage.setItem(KEY, hidden ? "1" : "0");
    applyDom(hidden);
    set({ hidden });
  },
}));

/**
 * O estado lido de fora do React, pra `formatCurrency` — que é uma função pura chamada de 399
 * lugares e não pode virar hook sem reescrever as 76 telas.
 *
 * Quem faz a tela se redesenhar quando isso muda é o `App`, que assina a store: ele re-renderiza e
 * o resto da árvore junto, então cada `formatCurrency` roda de novo. Sem esse assinante no topo o
 * valor continuaria na tela até algo mais acontecer.
 */
export function valuesHidden(): boolean {
  return usePrivacyStore.getState().hidden;
}
