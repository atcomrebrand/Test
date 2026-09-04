/**
 * Quais ativos entram no ticker rolante da Home, e em que ordem.
 *
 * Regras puras, sem I/O: quem chama já resolveu posição e preço. É o que permite travar em teste as
 * duas decisões que mudam o que aparece na tela sem precisar de banco nem de provedor de cotação.
 */

export interface TickerAssetInput {
  ticker: string;
  assetClass: string;
  /** Posição em carteira hoje. */
  quantity: number;
  /** Cotação atual, ou null quando o provedor não respondeu e nada há em cache. */
  price: number | null;
  /** Fechamento do pregão anterior, pra seta de alta/queda. Null omite a seta. */
  previousClose: number | null;
}

export interface TickerAssetItem {
  symbol: string;
  label: string;
  flag: string;
  rate: number;
  previousClose: number | null;
}

/** Um emoji por classe, no lugar onde o dólar mostra a bandeira — mesma anatomia de item. */
const CLASS_FLAG: Record<string, string> = {
  STOCK: "📈",
  FII: "🏢",
  CRYPTO: "🪙",
  FUND: "📊",
};

export function buildAssetTickerItems(inputs: TickerAssetInput[]): TickerAssetItem[] {
  return inputs
    .filter((a) => {
      // Ativo zerado não é "o que eu tenho": ele fica no cadastro pro histórico de compra e venda,
      // mas não é posição, e ficaria rolando na Home pra sempre depois de vendido.
      if (a.quantity <= 0) return false;
      // Sem cotação o item não tem o que mostrar. O dólar escreve "cotação indisponível" porque é
      // um item só; com a carteira inteira, um provedor fora do ar viraria uma parede de
      // "indisponível" rolando na tela — pior que a ausência.
      return a.price !== null && Number.isFinite(a.price) && a.price > 0;
    })
    // Maior posição primeiro: é a que move mais dinheiro, e o ticker é lido de passagem — o que
    // aparece antes é o que tem mais chance de ser visto.
    .sort((a, b) => b.quantity * (b.price ?? 0) - a.quantity * (a.price ?? 0))
    .map((a) => ({
      symbol: a.ticker,
      label: a.ticker,
      flag: CLASS_FLAG[a.assetClass] ?? "📈",
      rate: a.price as number,
      previousClose: a.previousClose,
    }));
}
