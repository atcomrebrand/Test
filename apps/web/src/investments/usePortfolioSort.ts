import { useCallback, useState } from "react";

/**
 * Preferência de exibição da Carteira guardada no localStorage.
 *
 * Preferência que reseta a cada visita vira uma tarefa recorrente: quem gosta de ver a carteira do
 * maior pro menor, ou o gráfico em 6 meses, quer isso sempre — não uma vez. Fica no localStorage e
 * não no servidor porque é preferência de tela, não dado: não vale uma coluna no banco nem uma
 * requisição a cada troca.
 */
function read<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T | null) ?? fallback;
  } catch {
    // localStorage bloqueado (aba anônima em alguns navegadores) não pode derrubar a página.
    return fallback;
  }
}

function usePersisted<T extends string>(storageKey: string, fallback: T) {
  const [value, setValueState] = useState<T>(() => read(storageKey, fallback));

  const setValue = useCallback(
    (next: T) => {
      setValueState(next);
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // Sem persistência a escolha ainda vale nesta sessão — só não sobrevive ao refresh.
      }
    },
    [storageKey],
  );

  return [value, setValue] as const;
}

export function usePortfolioSort<T extends string>(key: string, fallback: T) {
  return usePersisted(`investments-sort-${key}`, fallback);
}

/** Mesmo mecanismo, prefixo próprio: o que o gráfico de evolução guarda (período, modo) não é
 *  ordenação, e misturar os dois no mesmo namespace acabaria em chave colidindo. */
export function usePortfolioPreference<T extends string>(key: string, fallback: T) {
  return usePersisted(`investments-pref-${key}`, fallback);
}
