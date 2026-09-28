import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { CalculationContext, ProfitCalculatorService } from "./profit-calculator.service";
import {
  ChannelDto,
  FixedCostDto,
  ProductChannelPriceDto,
  ProductDto,
  SettingsDto,
  SimulateDto,
} from "./dto/profit.dto";

@Injectable()
export class ProfitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: ProfitCalculatorService,
  ) {}

  // ------------------------------------------------------------------ config

  /** Cria na primeira leitura em vez de exigir um passo de configuração: abrir o módulo pela
   *  primeira vez tem que mostrar a tela, não um formulário em branco pedindo permissão. */
  async settings(userId: string) {
    const existente = await this.prisma.profitSettings.findUnique({ where: { userId } });
    if (existente) return existente;
    return this.prisma.profitSettings.create({ data: { userId } });
  }

  async updateSettings(userId: string, dto: SettingsDto) {
    await this.settings(userId);
    return this.prisma.profitSettings.update({ where: { userId }, data: { ...dto } });
  }

  // ------------------------------------------------------------- custos fixos

  listFixedCosts(userId: string) {
    return this.prisma.profitFixedCost.findMany({ where: { userId }, orderBy: { name: "asc" } });
  }

  createFixedCost(userId: string, dto: FixedCostDto) {
    return this.prisma.profitFixedCost.create({ data: { userId, name: dto.name, amount: dto.amount, active: dto.active ?? true } });
  }

  async updateFixedCost(userId: string, id: string, dto: Partial<FixedCostDto>) {
    await this.ownFixedCost(userId, id);
    return this.prisma.profitFixedCost.update({ where: { id }, data: { ...dto } });
  }

  async removeFixedCost(userId: string, id: string) {
    await this.ownFixedCost(userId, id);
    await this.prisma.profitFixedCost.delete({ where: { id } });
    return { id };
  }

  // ------------------------------------------------------------------ canais

  listChannels(userId: string) {
    return this.prisma.profitChannel.findMany({ where: { userId, deletedAt: null }, orderBy: { name: "asc" } });
  }

  createChannel(userId: string, dto: ChannelDto) {
    return this.prisma.profitChannel.create({ data: { userId, ...dto } });
  }

  async updateChannel(userId: string, id: string, dto: Partial<ChannelDto>) {
    await this.ownChannel(userId, id);
    return this.prisma.profitChannel.update({ where: { id }, data: { ...dto } });
  }

  /** Arquiva, não apaga: o canal está referenciado nos preços já definidos, e sumir com ele levaria
   *  junto o preço que o produto tinha lá. */
  async archiveChannel(userId: string, id: string) {
    await this.ownChannel(userId, id);
    await this.prisma.profitChannel.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    return { id };
  }

  // ----------------------------------------------------------------- produtos

  /**
   * Todos os produtos com o melhor canal de cada um já resolvido.
   *
   * O "melhor" é calculado aqui e não na tela porque ele depende do imposto e das taxas de cada
   * canal — e é a resposta que a lista existe pra dar de relance.
   */
  async listProducts(userId: string) {
    const [produtos, ctx] = await Promise.all([
      this.prisma.profitProduct.findMany({
        where: { userId, deletedAt: null },
        orderBy: { name: "asc" },
        include: { channels: { include: { channel: true } } },
      }),
      this.calculator.context(userId),
    ]);

    return produtos.map((p) => {
      const porCanal = p.channels
        .filter((pc) => pc.channel.deletedAt === null && pc.price !== null)
        .map((pc) => ({
          channelId: pc.channelId,
          channelName: pc.channel.name,
          price: Number(pc.price),
          economics: this.calculator.toInput(p, pc.channel, Number(pc.price), ctx.taxPercent),
        }))
        .map((c) => ({ ...c, economics: this.calculator.analyze(c.economics, ctx, 0, 0).economics }));

      const melhor = [...porCanal].sort((a, b) => b.economics.profit - a.economics.profit)[0] ?? null;

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        cost: Number(p.cost),
        packagingCost: Number(p.packagingCost),
        extraCost: Number(p.extraCost),
        active: p.active,
        /** Quantos canais já têm preço definido — sem isso, "melhor canal" vazio parece bug. */
        pricedChannels: porCanal.length,
        bestChannel: melhor,
      };
    });
  }

  /**
   * Um produto, com TODOS os canais lado a lado.
   *
   * Canal sem preço definido entra na lista com o preço **sugerido** em vez de ficar de fora: a
   * pergunta "onde compensa vender isso" precisa incluir o lugar onde você ainda não vende.
   */
  async getProduct(userId: string, id: string, targetProfit = 0) {
    const produto = await this.ownProduct(userId, id);
    const [canais, ctx] = await Promise.all([this.listChannels(userId), this.calculator.context(userId)]);

    const precos = new Map(produto.channels.map((pc) => [pc.channelId, pc]));

    const comparison = canais.map((canal) => {
      const pc = precos.get(canal.id);
      const margemAlvo = Number(pc?.targetMarginPercent ?? ctx.defaultMarginPercent);
      const precoDefinido = pc?.price === null || pc?.price === undefined ? null : Number(pc.price);

      // Sem preço definido, a análise roda sobre o sugerido — mas `priceIsSuggested` diz isso, pra
      // tela nunca apresentar uma sugestão como se fosse o preço praticado.
      const base = this.calculator.toInput(produto, canal, precoDefinido ?? 0, ctx.taxPercent);
      const sugerido = this.calculator.analyze(base, ctx, margemAlvo, targetProfit).suggested;
      const preco = precoDefinido ?? (sugerido.ok ? sugerido.price : 0);

      return {
        channelId: canal.id,
        channelName: canal.name,
        channelType: canal.type,
        priceIsSuggested: precoDefinido === null,
        targetMarginPercent: margemAlvo,
        ...this.calculator.analyze(this.calculator.toInput(produto, canal, preco, ctx.taxPercent), ctx, margemAlvo, targetProfit),
      };
    });

    return {
      product: {
        id: produto.id,
        name: produto.name,
        sku: produto.sku,
        cost: Number(produto.cost),
        packagingCost: Number(produto.packagingCost),
        extraCost: Number(produto.extraCost),
        notes: produto.notes,
        active: produto.active,
      },
      context: { taxPercent: ctx.taxPercent, fixed: ctx.fixed, defaultMarginPercent: ctx.defaultMarginPercent },
      comparison,
    };
  }

  createProduct(userId: string, dto: ProductDto) {
    return this.prisma.profitProduct.create({ data: { userId, ...dto } });
  }

  async updateProduct(userId: string, id: string, dto: Partial<ProductDto>) {
    await this.ownProduct(userId, id);
    return this.prisma.profitProduct.update({ where: { id }, data: { ...dto } });
  }

  async archiveProduct(userId: string, id: string) {
    await this.ownProduct(userId, id);
    await this.prisma.profitProduct.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    return { id };
  }

  /** Define (ou limpa) o preço do produto naquele canal. `price: null` volta pro sugerido. */
  async setProductPrice(userId: string, productId: string, dto: ProductChannelPriceDto) {
    await this.ownProduct(userId, productId);
    await this.ownChannel(userId, dto.channelId);

    return this.prisma.profitProductChannel.upsert({
      where: { productId_channelId: { productId, channelId: dto.channelId } },
      create: { productId, channelId: dto.channelId, price: dto.price ?? null, targetMarginPercent: dto.targetMarginPercent ?? null },
      update: { price: dto.price ?? null, targetMarginPercent: dto.targetMarginPercent ?? null },
    });
  }

  // --------------------------------------------------------------- simulação

  /**
   * A calculadora avulsa: nada é gravado.
   *
   * Existe porque a pergunta mais comum é sobre um produto que você **ainda não comprou** — obrigar
   * a cadastrar antes de simular transformaria uma conta de dez segundos num cadastro.
   */
  async simulate(userId: string, dto: SimulateDto) {
    const ctx = await this.calculator.context(userId);
    const margemAlvo = dto.targetMarginPercent ?? ctx.defaultMarginPercent;

    const base = {
      cost: dto.cost,
      packagingCost: dto.packagingCost ?? 0,
      extraCost: dto.extraCost ?? 0,
      shippingCost: dto.shippingCost ?? 0,
      channelFee: { percent: dto.feePercent ?? 0, fixed: dto.feeFixed ?? 0 },
      returnRatePercent: dto.returnRatePercent ?? 0,
      taxPercent: ctx.taxPercent,
    };

    // Sem preço informado, a simulação roda em cima do sugerido — é o caso de quem está justamente
    // tentando descobrir por quanto vender.
    const sugerido = this.calculator.analyze({ ...base, price: 0 }, ctx, margemAlvo, dto.targetProfit ?? 0).suggested;
    const price = dto.price ?? (sugerido.ok ? sugerido.price : 0);

    return {
      context: { taxPercent: ctx.taxPercent, fixed: ctx.fixed, defaultMarginPercent: ctx.defaultMarginPercent },
      priceIsSuggested: dto.price === undefined,
      targetMarginPercent: margemAlvo,
      ...this.calculator.analyze({ ...base, price }, ctx, margemAlvo, dto.targetProfit ?? 0),
    };
  }

  // ------------------------------------------------------------------ guardas

  private async ownProduct(userId: string, id: string) {
    const p = await this.prisma.profitProduct.findUnique({ where: { id }, include: { channels: true } });
    if (!p || p.deletedAt) throw new NotFoundException("Produto não encontrado.");
    if (p.userId !== userId) throw new ForbiddenException();
    return p;
  }

  private async ownChannel(userId: string, id: string) {
    const c = await this.prisma.profitChannel.findUnique({ where: { id } });
    if (!c || c.deletedAt) throw new NotFoundException("Canal não encontrado.");
    if (c.userId !== userId) throw new ForbiddenException();
    return c;
  }

  private async ownFixedCost(userId: string, id: string) {
    const c = await this.prisma.profitFixedCost.findUnique({ where: { id } });
    if (!c) throw new NotFoundException("Custo fixo não encontrado.");
    if (c.userId !== userId) throw new ForbiddenException();
    return c;
  }
}
