export type ProfitChannelType = "MARKETPLACE" | "DIRECT" | "OWN_STORE" | "WHOLESALE";
export type ProfitTaxMode = "PERCENT" | "FIXED";

export interface ProfitSettings {
  taxEnabled: boolean;
  taxMode: ProfitTaxMode;
  taxPercent: string;
  taxMonthly: string;
  defaultMarginPercent: string;
}

/**
 * O que se MANDA ao salvar as configurações.
 *
 * Separado do de leitura porque Decimal do Prisma chega como string no JSON mas vai como número na
 * requisição — reusar o mesmo tipo obrigaria a converter pra string só pra agradar o compilador, e
 * aí o número certo viraria texto no meio do caminho.
 */
export interface ProfitSettingsInput {
  taxEnabled?: boolean;
  taxMode?: ProfitTaxMode;
  taxPercent?: number;
  taxMonthly?: number;
  defaultMarginPercent?: number;
}

export interface ProfitFixedCost {
  id: string;
  name: string;
  amount: string;
  active: boolean;
}

export interface ProfitChannel {
  id: string;
  name: string;
  type: ProfitChannelType;
  feePercent: string;
  feeFixed: string;
  shippingCost: string;
  returnRatePercent: string;
  active: boolean;
}

/** Tudo em reais por unidade, já resolvido pelo servidor. */
export interface UnitEconomics {
  price: number;
  productCost: number;
  packagingCost: number;
  shippingCost: number;
  extraCost: number;
  channelFeeAmount: number;
  taxAmount: number;
  returnLoss: number;
  variableCost: number;
  profit: number;
  /** Lucro ÷ preço. É esta que as pessoas querem dizer quando falam "margem". */
  marginPercent: number;
  /** Preço ÷ custo − 1. Sempre maior que a margem. */
  markupPercent: number;
  roiPercent: number;
  contributionMargin: number;
}

/** `ok: false` quando os percentuais somam 100% — aí não existe preço, e a tela precisa dizer isso
 *  em vez de mostrar um número. */
export type PriceSuggestion =
  | { ok: true; price: number; economics: UnitEconomics }
  | { ok: false; reason: "PERCENTUAIS_IMPOSSIVEIS"; totalPercent: number };

export interface BreakEven {
  monthlyCost: number;
  contributionMargin: number;
  /** `null` = margem de contribuição zero ou negativa: nenhuma quantidade de vendas paga o fixo. */
  units: number | null;
  revenue: number | null;
}

export interface TargetResult extends BreakEven {
  targetProfit: number;
  unitsForTarget: number | null;
  revenueForTarget: number | null;
  unitsBeyondBreakEven: number | null;
}

export interface DiscountImpact {
  discountPercent: number;
  newPrice: number;
  newEconomics: UnitEconomics;
  profitLost: number;
  profitLostPercent: number;
  extraUnitsForSameProfit: number | null;
  belowMinimum: boolean;
}

export interface Analysis {
  economics: UnitEconomics;
  suggested: PriceSuggestion;
  minimum: PriceSuggestion;
  breakEven: BreakEven;
  target: TargetResult;
  discounts: DiscountImpact[];
}

export interface CalculationContext {
  taxPercent: number;
  fixed: { monthlyFixedCost: number; monthlyFixedTax: number };
  defaultMarginPercent: number;
}

export interface ProfitProductSummary {
  id: string;
  name: string;
  sku: string | null;
  cost: number;
  packagingCost: number;
  extraCost: number;
  active: boolean;
  pricedChannels: number;
  bestChannel: { channelId: string; channelName: string; price: number; economics: UnitEconomics } | null;
}

export interface ChannelComparison extends Analysis {
  channelId: string;
  channelName: string;
  channelType: ProfitChannelType;
  /** O preço mostrado é sugestão, não o que você pratica. A tela nunca pode confundir os dois. */
  priceIsSuggested: boolean;
  targetMarginPercent: number;
}

export interface ProfitProductDetail {
  product: {
    id: string;
    name: string;
    sku: string | null;
    cost: number;
    packagingCost: number;
    extraCost: number;
    notes: string | null;
    active: boolean;
  };
  context: CalculationContext;
  comparison: ChannelComparison[];
}

export interface SimulationResult extends Analysis {
  context: CalculationContext;
  priceIsSuggested: boolean;
  targetMarginPercent: number;
}
