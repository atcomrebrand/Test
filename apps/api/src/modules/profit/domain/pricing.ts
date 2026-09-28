/**
 * A economia de UMA venda: o que entra, o que sai e o que sobra.
 *
 * A regra que sustenta o módulo inteiro é que **taxa percentual incide sobre o PREÇO, não sobre o
 * lucro**. É daí que sai a diferença entre a conta intuitiva e a certa, e ela não é pequena: custo
 * de R$ 50 com 20% de taxa e 20% de margem desejada dá R$ 70 pela conta de somar os percentuais
 * (que entrega 8,6% de margem real) e R$ 83,33 pela conta certa. Quase o dobro de lucro.
 */

/** Um percentual cobrado sobre o preço de venda, mais um valor fixo por pedido. É a forma que
 *  marketplace, gateway e maquininha usam — e somar só o percentual esquece metade da conta. */
export interface FeeRate {
  percent: number;
  fixed: number;
}

export interface UnitEconomicsInput {
  /** Preço de venda ao cliente. */
  price: number;
  /** Quanto você pagou no produto. */
  cost: number;
  /** Embalagem, etiqueta, brinde — por unidade. */
  packagingCost: number;
  /** Frete que VOCÊ paga (frete grátis). O frete pago pelo cliente não entra: não é seu custo. */
  shippingCost: number;
  /** Comissão do canal (marketplace, gateway, maquininha). */
  channelFee: FeeRate;
  /** Imposto sobre faturamento (Simples). Zero quando desligado ou quando é valor fixo mensal —
   *  DAS de MEI não é custo por unidade, é custo fixo do mês. */
  taxPercent: number;
  /** Devolução esperada, em % das vendas. Numa devolução você devolve o preço e ainda perde o que
   *  gastou pra mandar; por isso ela é aplicada sobre o desembolso, não sobre o lucro. */
  returnRatePercent: number;
  /** Outros custos por unidade que não se encaixam acima. */
  extraCost: number;
}

export interface UnitEconomics {
  price: number;
  /** Tudo que sai do seu bolso por unidade vendida. */
  productCost: number;
  packagingCost: number;
  shippingCost: number;
  extraCost: number;
  /** Comissão do canal já resolvida em reais (percentual sobre o preço + o fixo). */
  channelFeeAmount: number;
  taxAmount: number;
  returnLoss: number;
  /** Soma de tudo que varia com a venda. */
  variableCost: number;
  profit: number;
  /** Lucro ÷ preço. É esta que as pessoas querem dizer quando falam "margem". */
  marginPercent: number;
  /** Preço ÷ custo − 1. Sempre maior que a margem, e confundir os dois é o erro clássico. */
  markupPercent: number;
  /** Lucro ÷ o que você desembolsou. Responde "valeu a pena pôr esse dinheiro aqui". */
  roiPercent: number;
  /** O que cada venda deixa pra pagar o custo fixo do mês. Acima do ponto de equilíbrio, é lucro. */
  contributionMargin: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Percentual só vira divisor/multiplicador depois de virar fração — e negativo não existe aqui. */
function pct(value: number): number {
  return Math.max(0, value) / 100;
}

/**
 * Quanto sobra de uma venda, e os três números que descrevem esse "sobra".
 *
 * **Margem, markup e ROI são coisas diferentes** e o módulo devolve os três nomeados de propósito:
 * comprou por 50 e vendeu por 100 é markup de 100%, margem de 50% e ROI de 100%. Quem calcula
 * markup e lê como margem acha que ganha o dobro do que ganha.
 */
export function computeUnitEconomics(input: UnitEconomicsInput): UnitEconomics {
  const price = Math.max(0, input.price);
  const productCost = Math.max(0, input.cost);
  const packagingCost = Math.max(0, input.packagingCost);
  const shippingCost = Math.max(0, input.shippingCost);
  const extraCost = Math.max(0, input.extraCost);

  const channelFeeAmount = price * pct(input.channelFee.percent) + Math.max(0, input.channelFee.fixed);
  const taxAmount = price * pct(input.taxPercent);

  // Numa devolução o dinheiro da venda volta pro cliente e o que você gastou pra despachar não
  // volta. Então a perda esperada é a fração devolvida do DESEMBOLSO, não do lucro.
  const desembolso = productCost + packagingCost + shippingCost + extraCost;
  const returnLoss = desembolso * pct(input.returnRatePercent);

  const variableCost = desembolso + channelFeeAmount + taxAmount + returnLoss;
  const profit = price - variableCost;

  return {
    price: round2(price),
    productCost: round2(productCost),
    packagingCost: round2(packagingCost),
    shippingCost: round2(shippingCost),
    extraCost: round2(extraCost),
    channelFeeAmount: round2(channelFeeAmount),
    taxAmount: round2(taxAmount),
    returnLoss: round2(returnLoss),
    variableCost: round2(variableCost),
    profit: round2(profit),
    // Preço zero não tem margem: devolver 0 diria "vendeu sem lucro", e o certo é que a pergunta
    // não se aplica.
    marginPercent: price > 0 ? round2((profit / price) * 100) : 0,
    markupPercent: desembolso > 0 ? round2((price / desembolso - 1) * 100) : 0,
    roiPercent: desembolso > 0 ? round2((profit / desembolso) * 100) : 0,
    contributionMargin: round2(profit),
  };
}

export type PriceSuggestion =
  | { ok: true; price: number; economics: UnitEconomics }
  | { ok: false; reason: "PERCENTUAIS_IMPOSSIVEIS"; totalPercent: number };

export interface SuggestPriceInput extends Omit<UnitEconomicsInput, "price"> {
  /** A margem que você QUER sobre o preço final. */
  targetMarginPercent: number;
}

/**
 * O preço que entrega a margem desejada — resolvido, não somado.
 *
 * A conta intuitiva (`custo × (1 + taxa + margem)`) erra porque aplica os percentuais sobre o
 * custo, quando na vida real eles são cobrados sobre o preço. O preço certo sai de isolar P em
 * `P = custos_fixos_da_unidade + P×(taxas + imposto + margem)`, ou seja
 * **`P = custos ÷ (1 − soma dos percentuais)`** — o chamado markup divisor.
 *
 * Quando os percentuais somam 100% ou mais, **não existe preço**: o divisor é zero ou negativo, e
 * qualquer preço que você cobrar é consumido inteiro pelas taxas. Devolver "infinito" ou um número
 * negativo aqui faria a tela sugerir um preço impossível com cara de resposta; por isso o retorno é
 * um resultado e não um número.
 */
export function suggestPrice(input: SuggestPriceInput): PriceSuggestion {
  const somaPercentual = pct(input.channelFee.percent) + pct(input.taxPercent) + pct(input.targetMarginPercent);

  if (somaPercentual >= 1) {
    return { ok: false, reason: "PERCENTUAIS_IMPOSSIVEIS", totalPercent: round2(somaPercentual * 100) };
  }

  const desembolso =
    Math.max(0, input.cost) + Math.max(0, input.packagingCost) + Math.max(0, input.shippingCost) + Math.max(0, input.extraCost);
  // A devolução esperada também é custo por unidade, então entra no numerador junto com o resto.
  const custosDaUnidade = desembolso * (1 + pct(input.returnRatePercent)) + Math.max(0, input.channelFee.fixed);

  const price = round2(custosDaUnidade / (1 - somaPercentual));
  return { ok: true, price, economics: computeUnitEconomics({ ...input, price }) };
}

/**
 * O preço em que a venda não dá lucro nem prejuízo — o piso.
 *
 * É o mesmo cálculo com margem zero, e é o número mais útil na hora do desconto: abaixo dele você
 * está pagando pra vender.
 */
export function minimumPrice(input: Omit<SuggestPriceInput, "targetMarginPercent">): PriceSuggestion {
  return suggestPrice({ ...input, targetMarginPercent: 0 });
}
