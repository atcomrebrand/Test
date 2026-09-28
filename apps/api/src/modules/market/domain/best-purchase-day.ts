import { ProductPricePoint, groupPurchaseOccasions } from "./product-price-history";

export interface DayPriceObservation extends ProductPricePoint {
  /** Qual produto essa linha é. A comparação só existe dentro do mesmo produto. */
  productId: string;
}

/**
 * O recorte de tempo comparado.
 *
 * `WEEKDAY` responde "compensa comprar na segunda ou no sábado" e `DAY_OF_MONTH`, "compensa comprar
 * no dia 5 ou no dia 28". São a mesma conta com um agrupamento diferente, e por isso um código só:
 * duplicar o cálculo faria os dois divergirem no dia em que um deles fosse ajustado.
 *
 * Os dois não têm a mesma facilidade de encher: são 7 grupos contra 31, então o dia do mês precisa
 * de bem mais histórico pra sair do "ainda não dá pra saber". Isso é do dado, não do cálculo.
 */
export type DayBucket = "WEEKDAY" | "DAY_OF_MONTH";

export interface DayPriceIndex {
  /** 0–6 (domingo=0) em WEEKDAY; 1–31 em DAY_OF_MONTH. */
  day: number;
  /** 100 = o preço de sempre. 96 = costuma sair 4% mais barato nesse dia. */
  index: number;
  /** Quantas comparações produto×ida entraram nesse dia. */
  observations: number;
  /** Quantos produtos distintos sustentam o número — 1 produto não é um padrão. */
  products: number;
}

export type BestDayReason = "SEM_COMPRAS" | "SEM_PRODUTO_REPETIDO" | "POUCA_AMOSTRA";

export interface BestPurchaseDay {
  /** O dia mais barato. `null` quando ainda não dá pra afirmar — aí `reason` diz por quê. */
  best: DayPriceIndex | null;
  /** Todos os dias que reuniram amostra, do mais barato pro mais caro. */
  days: DayPriceIndex[];
  /** Produtos que puderam ser comparados entre dias diferentes — a base de tudo. */
  comparableProducts: number;
  observations: number;
  reason: BestDayReason | null;
}

/** Um produto precisa aparecer em pelo menos dois dias DIFERENTES pra dizer algo sobre dia.
 *  Comprado sempre na segunda, ele só sabe informar o próprio preço. */
const MIN_DAYS_PER_PRODUCT = 2;
/** Um dia sustentado por uma observação só é anedota, não padrão. */
const MIN_OBSERVATIONS_PER_DAY = 2;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Em que dia a compra sai mais barata — dia da semana ou dia do mês, conforme o `bucket`.
 *
 * **O que este cálculo NÃO faz: comparar o gasto médio por ida.** Essa é a conta óbvia e é errada.
 * O gasto de uma ida depende do que entrou no carrinho, não do preço do dia: o rancho do mês, que
 * costuma cair no sábado, faria o sábado parecer o dia mais caro do ano quando o que aconteceu foi
 * comprar mais coisa. A pergunta é sobre **preço**, então a medida tem que ser de preço.
 *
 * O que ele faz é comparar **cada produto consigo mesmo**. Para cada produto, o preço de uma ida
 * vira uma razão sobre o preço médio daquele produto; a razão é adimensional, então arroz e
 * detergente entram na mesma média sem que o mais caro domine. O índice de um dia é a média dessas
 * razões, em base 100.
 *
 * Só entram produtos comprados em **mais de um dia distinto** dentro do recorte. Um produto sempre
 * comprado na segunda (ou sempre no dia 5) tem razão exatamente 1 por construção — não erra o
 * resultado, mas empurra todo dia pra 100 e apaga justamente o sinal que a tela quer mostrar.
 *
 * Quando não há base, devolve `best: null` com o motivo, e nunca um dia qualquer: apontar a
 * segunda-feira porque foi a única com dado é pior do que dizer que ainda não dá pra saber — a
 * pessoa mudaria a rotina de compras por causa de um número que não mediu nada. Isso acontece bem
 * mais no recorte de dia do mês, que reparte a mesma amostra em 31 grupos em vez de 7.
 */
export function bestPurchaseDay(observations: DayPriceObservation[], bucket: DayBucket): BestPurchaseDay {
  const vazio = (reason: BestDayReason): BestPurchaseDay => ({
    best: null,
    days: [],
    comparableProducts: 0,
    observations: 0,
    reason,
  });

  if (observations.length === 0) return vazio("SEM_COMPRAS");

  const porProduto = new Map<string, DayPriceObservation[]>();
  for (const o of observations) {
    const atual = porProduto.get(o.productId);
    if (atual) atual.push(o);
    else porProduto.set(o.productId, [o]);
  }

  // razão de preço → dia, uma entrada por produto×ida ao mercado.
  const razoesPorDia = new Map<number, { soma: number; observations: number; produtos: Set<string> }>();
  let comparableProducts = 0;
  let total = 0;

  for (const [productId, pontos] of porProduto) {
    // Uma ida ao mercado, não uma linha de nota: três unidades do mesmo produto são um preço só.
    const ocasioes = groupPurchaseOccasions(pontos);
    const diasDistintos = new Set(ocasioes.map((o) => dayOf(o.purchaseDate, bucket)));
    if (diasDistintos.size < MIN_DAYS_PER_PRODUCT) continue;

    // Média ponderada pela quantidade, a mesma régua do `averagePrice`: um saco de 5kg em promoção
    // pesa mais que uma reposição de 300g a preço cheio.
    const quantidade = ocasioes.reduce((acc, o) => acc + o.quantity, 0);
    const gasto = ocasioes.reduce((acc, o) => acc + o.totalPrice, 0);
    const medio = quantidade > 0 ? gasto / quantidade : 0;
    if (medio <= 0) continue;

    comparableProducts += 1;

    for (const ocasiao of ocasioes) {
      const dia = dayOf(ocasiao.purchaseDate, bucket);
      const atual = razoesPorDia.get(dia) ?? { soma: 0, observations: 0, produtos: new Set<string>() };
      atual.soma += ocasiao.unitPrice / medio;
      atual.observations += 1;
      atual.produtos.add(productId);
      razoesPorDia.set(dia, atual);
      total += 1;
    }
  }

  if (comparableProducts === 0) return vazio("SEM_PRODUTO_REPETIDO");

  const days = [...razoesPorDia.entries()]
    .filter(([, v]) => v.observations >= MIN_OBSERVATIONS_PER_DAY)
    .map(([day, v]) => ({
      day,
      index: round2((v.soma / v.observations) * 100),
      observations: v.observations,
      products: v.produtos.size,
    }))
    // Empate resolve pelo dia com mais amostra: entre dois dias igualmente baratos, o mais
    // observado é o que a pessoa pode confiar.
    .sort((a, b) => a.index - b.index || b.observations - a.observations);

  // Menos de dois dias com amostra não é comparação: ou sobrou um dia só, que não se compara com
  // ninguém, ou nenhum passou do mínimo. Os dois querem dizer a mesma coisa pra quem lê a tela —
  // "ainda não dá pra afirmar" — e separá-los em duas frases não mudaria nada do que fazer.
  if (days.length < 2) {
    return { best: null, days, comparableProducts, observations: total, reason: "POUCA_AMOSTRA" };
  }

  return { best: days[0], days, comparableProducts, observations: total, reason: null };
}

/**
 * O grupo de uma data "yyyy-mm-dd": dia da semana (0–6) ou dia do mês (1–31).
 *
 * Montada com os componentes, e não com `new Date(iso)`: a string pura é interpretada como UTC, e
 * num fuso negativo como o do Brasil isso joga a compra pro dia anterior — uma nota de segunda dia
 * 17 vira domingo dia 16, errando os dois recortes de uma vez.
 */
function dayOf(iso: string, bucket: DayBucket): number {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return bucket === "DAY_OF_MONTH" ? dia : new Date(ano, mes - 1, dia).getDay();
}
