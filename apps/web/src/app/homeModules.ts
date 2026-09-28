/**
 * A ordem dos módulos na Home.
 *
 * A preferência guarda uma lista de rotas ("/academia", "/parcelas"...), e não índices: índice
 * quebra em silêncio no dia em que um módulo é criado ou removido, e o card errado troca de lugar
 * sem ninguém entender por quê.
 */
export interface OrderableModule {
  to: string;
}

/**
 * Aplica a preferência à lista real de módulos.
 *
 * Três casos, e cada um tem uma resposta deliberada:
 *
 * - **Sem preferência** (lista vazia): devolve a ordem padrão do código. É o que faz quem nunca
 *   mexeu nisso não ver nada mudar.
 * - **Módulo que existe e não está na preferência**: vai pro FIM, mantendo a ordem em que aparece
 *   no código. Esse é o caso do módulo novo — quem salvou a ordem antes dele existir não podia
 *   tê-lo incluído, e sumir seria a pior resposta possível.
 * - **Rota salva que não existe mais**: some. Módulo removido não pode deixar um buraco na lista.
 */
export function orderModules<T extends OrderableModule>(modules: T[], preference: string[] | undefined): T[] {
  if (!preference || preference.length === 0) return modules;

  const porRota = new Map(modules.map((m) => [m.to, m]));
  const escolhidos: T[] = [];
  for (const rota of preference) {
    const m = porRota.get(rota);
    // `delete` também protege de rota repetida na preferência: o módulo entra uma vez só.
    if (m) {
      escolhidos.push(m);
      porRota.delete(rota);
    }
  }
  // O que sobrou mantém a ordem do código, não a do Map.
  return [...escolhidos, ...modules.filter((m) => porRota.has(m.to))];
}
