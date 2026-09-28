/**
 * O que fazer quando alguém pede a cotação de um ativo.
 *
 * O problema que isso resolve: quando a BRAPI fica fora do ar, cada símbolo esperava os 8s do
 * timeout **antes** de cair no valor em cache. Numa carteira de ~20 tickers, em lotes de 4, a tela
 * levava ~40s pra exibir exatamente o mesmo número que já estava no banco no instante zero. E como
 * a falha não era registrada em lugar nenhum, a requisição seguinte recomeçava a fila inteira.
 *
 * A regra aqui é: **nunca faça o usuário esperar a rede por um número que já temos.** Cache velho
 * some na hora e a atualização acontece por fora; a espera só existe quando não há nada pra mostrar.
 */

export type RemoteFetchAction =
  /** Cache dentro do TTL — devolve e não toca na rede. */
  | "SERVE_FRESH"
  /** Tem valor guardado, só que velho: devolve já e atualiza em segundo plano. */
  | "SERVE_STALE_REFRESH_IN_BACKGROUND"
  /** Não há nada pra mostrar — só aqui vale segurar a resposta esperando o provedor. */
  | "FETCH_BLOCKING"
  /** Nada em cache e o provedor falhou há pouco: devolve vazio na hora em vez de pagar o timeout. */
  | "GIVE_UP";

export interface RemoteCacheState {
  /** Quando o valor guardado foi buscado. null = nunca houve busca bem-sucedida. */
  cachedAt: Date | null;
  /** Até quando esse símbolo está em quarentena depois de uma falha. null = sem falha recente. */
  backoffUntil: Date | null;
  /** Ação explícita do usuário ("atualizar agora") — aí esperar é o comportamento esperado. */
  forceRefresh: boolean;
  ttlMs: number;
  now: Date;
}

export function decideRemoteFetch({ cachedAt, backoffUntil, forceRefresh, ttlMs, now }: RemoteCacheState): RemoteFetchAction {
  const inBackoff = backoffUntil !== null && backoffUntil.getTime() > now.getTime();

  // Pedido explícito do usuário fura o TTL, mas não a quarentena: insistir num provedor que acabou
  // de falhar só entrega o mesmo timeout de novo, agora com o usuário olhando pra tela.
  if (forceRefresh) {
    if (!inBackoff) return "FETCH_BLOCKING";
    return cachedAt !== null ? "SERVE_FRESH" : "GIVE_UP";
  }

  if (cachedAt !== null && now.getTime() - cachedAt.getTime() < ttlMs) return "SERVE_FRESH";

  if (cachedAt !== null) {
    // Valor velho na mão: devolve agora. Em quarentena, nem agenda a atualização — seria mais uma
    // conexão pendurada num provedor que já se sabe fora do ar.
    return inBackoff ? "SERVE_FRESH" : "SERVE_STALE_REFRESH_IN_BACKGROUND";
  }

  return inBackoff ? "GIVE_UP" : "FETCH_BLOCKING";
}
