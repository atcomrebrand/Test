import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { FixedCostsInput, computeBreakEven, discountImpact, unitsForTargetProfit } from "../domain/break-even";
import { UnitEconomicsInput, computeUnitEconomics, minimumPrice, suggestPrice } from "../domain/pricing";
import { psychologicalPrices } from "../domain/psychological-price";

/** Descontos que a tela sempre mostra. Fixos de propósito: a pergunta "e se eu der 10%?" é a mesma
 *  toda vez, e obrigar a digitar transformaria uma leitura de relance num formulário. */
const DESCONTOS_PADRAO = [5, 10, 15, 20];

export interface CalculationContext {
  /** Percentual do imposto que entra no PREÇO. Zero quando desligado ou no modo valor fixo. */
  taxPercent: number;
  /** Custo fixo do mês, já com o DAS quando o imposto é fixo. */
  fixed: FixedCostsInput;
  defaultMarginPercent: number;
}

@Injectable()
export class ProfitCalculatorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * O contexto do usuário: imposto e custo fixo.
   *
   * **O imposto cai em um de dois lugares, nunca nos dois.** Em `PERCENT` ele entra no preço de cada
   * venda (e por isso vai pro divisor); em `FIXED` ele é o DAS do MEI, que não muda o preço de nada
   * e soma ao custo fixo do mês. Desligado, não entra em lugar nenhum. Resolver isso aqui, uma vez,
   * evita que cada tela tenha que lembrar da regra.
   */
  async context(userId: string): Promise<CalculationContext> {
    const [settings, custos] = await Promise.all([
      this.prisma.profitSettings.findUnique({ where: { userId } }),
      this.prisma.profitFixedCost.findMany({ where: { userId, active: true } }),
    ]);

    const monthlyFixedCost = custos.reduce((acc, c) => acc + Number(c.amount), 0);
    const ligado = settings?.taxEnabled ?? false;
    const modo = settings?.taxMode ?? "PERCENT";

    return {
      taxPercent: ligado && modo === "PERCENT" ? Number(settings!.taxPercent) : 0,
      fixed: {
        monthlyFixedCost,
        monthlyFixedTax: ligado && modo === "FIXED" ? Number(settings!.taxMonthly) : 0,
      },
      defaultMarginPercent: Number(settings?.defaultMarginPercent ?? 20),
    };
  }

  /**
   * Tudo que se pode dizer sobre uma venda: o que sobra, o preço ideal, o piso, o equilíbrio e o
   * estrago de cada desconto.
   *
   * Montado num lugar só porque as cinco respostas vêm dos mesmos números — calcular cada uma numa
   * chamada separada faria a tela pedir cinco vezes a mesma coisa, e abriria espaço pra elas
   * discordarem entre si.
   */
  analyze(input: UnitEconomicsInput, ctx: CalculationContext, targetMarginPercent: number, targetProfit: number) {
    const economics = computeUnitEconomics(input);
    const semPreco = { ...input } as Omit<UnitEconomicsInput, "price"> & { price?: number };
    delete semPreco.price;

    const sugerido = suggestPrice({ ...(semPreco as Omit<UnitEconomicsInput, "price">), targetMarginPercent });
    const piso = minimumPrice(semPreco as Omit<UnitEconomicsInput, "price">);

    return {
      economics,
      /** O preço que entrega a margem desejada. Pode vir `ok: false` quando os percentuais somam
       *  100% — e aí a tela precisa dizer isso, não mostrar um número. */
      suggested: sugerido,
      minimum: piso,
      /**
       * Os preços "de prateleira" acima do sugerido, cada um com a margem que ELE entrega.
       *
       * Mostrar o preço bonito sem dizer o que ele fez com o lucro seria trocar precisão por
       * estética sem avisar — e é justamente o tipo de troca silenciosa que o módulo existe pra
       * impedir.
       */
      rounded: sugerido.ok
        ? psychologicalPrices(sugerido.price).map((o) => ({
            ...o,
            economics: computeUnitEconomics({ ...(semPreco as Omit<UnitEconomicsInput, "price">), price: o.price }),
          }))
        : [],
      breakEven: computeBreakEven(economics, ctx.fixed),
      target: unitsForTargetProfit(economics, ctx.fixed, targetProfit),
      discounts: DESCONTOS_PADRAO.map((d) => discountImpact(input, d)),
    };
  }

  /** Monta a entrada do cálculo a partir de produto + canal + imposto. É o único lugar que sabe
   *  montar isso, pra tela e comparação não divergirem. */
  toInput(
    product: { cost: unknown; packagingCost: unknown; extraCost: unknown },
    channel: { feePercent: unknown; feeFixed: unknown; shippingCost: unknown; returnRatePercent: unknown },
    price: number,
    taxPercent: number,
  ): UnitEconomicsInput {
    return {
      price,
      cost: Number(product.cost),
      packagingCost: Number(product.packagingCost),
      extraCost: Number(product.extraCost),
      shippingCost: Number(channel.shippingCost),
      channelFee: { percent: Number(channel.feePercent), fixed: Number(channel.feeFixed) },
      returnRatePercent: Number(channel.returnRatePercent),
      taxPercent,
    };
  }
}
