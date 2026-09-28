import { useEffect, useState } from "react";

/**
 * Atrasa o valor até ele parar de mudar.
 *
 * O simulador calcula no servidor (é lá que moram as regras de IR/IOF que batem com o extrato), e
 * sem isso cada tecla digitada num campo de valor viraria uma requisição — numa VPS de 1GB, digitar
 * "10000" são cinco.
 */
export function useDebounced<T>(value: T, delayMs = 400): T {
  const [atrasado, setAtrasado] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setAtrasado(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return atrasado;
}
