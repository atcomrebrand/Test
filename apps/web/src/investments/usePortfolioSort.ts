import { useCallback, useState } from "react";

/**
 * Guarda a ordenação escolhida no localStorage.
 *
 * Preferência de exibição que reseta a cada visita vira uma tarefa recorrente: quem gosta de ver a
 * carteira do maior pro menor quer isso sempre, não uma vez. Fica no localStorage e não no servidor
 * porque é preferência de tela, não dado — não vale uma coluna no banco nem uma requisição.
 */
function read<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T | null) ?? fallback;
  } catch {
    // localStorage bloqueado (aba anônima em alguns navegadores) não pode derrubar a página.
    return fallback;
  }
}

export function usePortfolioSort<T extends string>(key: string, fallback: T) {
  const storageKey = `investments-sort-${key}`;
  const [sort, setSortState] = useState<T>(() => read(storageKey, fallback));

  const setSort = useCallback(
    (value: T) => {
      setSortState(value);
      try {
        localStorage.setItem(storageKey, value);
      } catch {
        // Sem persistência a ordenação ainda funciona nesta sessão — só não sobrevive ao refresh.
      }
    },
    [storageKey],
  );

  return [sort, setSort] as const;
}
