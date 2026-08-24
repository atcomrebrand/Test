import { Injectable } from "@nestjs/common";
import { InvestmentAssetClass } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { TrackingFxService } from "../tracking/application/tracking-fx.service";
import { AssetRepository } from "../investments/domain/asset.repository";
import { MarketPriceService } from "../investments/infrastructure/market-price.service";
import { storageTicker } from "../investments/infrastructure/asset-history.service";
import { calculatePosition } from "../investments/domain/position-calculator";
import { todayInBrazil } from "../investments/domain/fixed-income-calculator";
import { buildAssetTickerItems, TickerAssetInput } from "./domain/asset-ticker";

export interface QuoteTickerItem {
  symbol: string;
  label: string;
  flag: string;
  rate: number | null;
  /** Previous trading day's close, when the source that answered this request exposes one — null
   *  hides the rising/falling indicator on the frontend rather than showing a misleading arrow. */
  previousClose: number | null;
  /** Moeda é cotada com 3 casas (o movimento do par se perde em 2); ativo com 2, do jeito que
   *  preço de ação se escreve. Sem isso um BTC apareceria como "R$ 320.000,000". */
  kind: "CURRENCY" | "ASSET";
}

/** A Home abre o tempo todo e o ticker ainda revalida sozinho a cada 5min. Um minuto de cache por
 *  usuário corta a repetição sem atrasar de forma perceptível um número que muda devagar. */
const TICKER_TTL_MS = 60 * 1000;

/** Quantos dias pra trás procurar o fechamento anterior: cobre fim de semana emendado com feriado
 *  sem varrer a tabela inteira. */
const PREVIOUS_CLOSE_LOOKBACK_DAYS = 10;

/**
 * Cotações do ticker rolante da Home: o dólar mais os ativos que a pessoa tem em carteira.
 *
 * O dólar reaproveita o cache+fallback do Horas (TrackingFxService) e os ativos reaproveitam o
 * `MarketPriceService`, que serve o preço guardado na hora e atualiza por fora — nada aqui espera a
 * rede. Duas fontes brigando pelo mesmo número é o que se evita mantendo tudo em cima dos caches
 * que já existem.
 */
@Injectable()
export class QuotesService {
  private readonly cache = new Map<string, { items: QuoteTickerItem[]; at: number }>();

  constructor(
    private readonly fx: TrackingFxService,
    private readonly assets: AssetRepository,
    private readonly prices: MarketPriceService,
    private readonly prisma: PrismaService,
  ) {}

  async ticker(userId: string): Promise<QuoteTickerItem[]> {
    const guardado = this.cache.get(userId);
    if (guardado && Date.now() - guardado.at < TICKER_TTL_MS) return guardado.items;

    const [moedas, ativos] = await Promise.all([this.currencyItems(), this.assetItems(userId)]);
    const items = [...moedas, ...ativos];

    this.cache.set(userId, { items, at: Date.now() });
    return items;
  }

  /** Só as moedas, sem tocar na carteira — é o que o assistente precisa quando perguntam "quanto
   *  está o dólar", e não faz sentido montar o ticker inteiro pra ler um item. */
  async currencies(): Promise<QuoteTickerItem[]> {
    return this.currencyItems();
  }

  private async currencyItems(): Promise<QuoteTickerItem[]> {
    const quote = await this.fx.getUsdToBrlQuote();
    return [
      {
        symbol: "USD",
        label: "USD",
        flag: "🇺🇸",
        rate: quote?.rate ?? null,
        previousClose: quote?.previousClose ?? null,
        kind: "CURRENCY",
      },
    ];
  }

  private async assetItems(userId: string): Promise<QuoteTickerItem[]> {
    const rows = await this.assets.findAllByUser(userId);
    if (rows.length === 0) return [];

    // Uma consulta pro extrato inteiro em vez de uma por ativo: a Home é a tela que mais abre, e
    // foi exatamente com N+1 nela que a VPS de 1GB já engasgou antes.
    const transacoes = await this.assets.listAllTransactionsByUser(userId);
    const porAtivo = new Map<string, { type: "BUY" | "SELL"; quantity: number; unitPrice: number; fees: number; transactionDate: Date }[]>();
    for (const t of transacoes) {
      const lista = porAtivo.get(t.assetId) ?? [];
      lista.push({
        type: t.type === "BUY" ? "BUY" : "SELL",
        quantity: Number(t.quantity),
        unitPrice: Number(t.unitPrice),
        fees: Number(t.fees),
        transactionDate: t.transactionDate,
      });
      porAtivo.set(t.assetId, lista);
    }

    const comPosicao = rows
      .map((asset) => ({ asset, position: calculatePosition(porAtivo.get(asset.id) ?? []) }))
      .filter((a) => a.position.quantity > 0);
    if (comPosicao.length === 0) return [];

    const fechamentos = await this.previousCloses(comPosicao.map((a) => a.asset));

    const entradas: TickerAssetInput[] = await Promise.all(
      comPosicao.map(async ({ asset, position }) => {
        const quote = await this.prices.getPrice(asset.class, asset.ticker).catch(() => null);
        return {
          ticker: asset.ticker,
          assetClass: asset.class,
          quantity: position.quantity,
          price: quote?.price ?? null,
          previousClose: fechamentos.get(storageTicker(asset.class, asset.ticker)) ?? null,
        };
      }),
    );

    return buildAssetTickerItems(entradas).map((item) => ({ ...item, kind: "ASSET" as const }));
  }

  /**
   * Fechamento do pregão anterior, tirado de `historical_prices` — a mesma tabela que o gráfico de
   * evolução da Carteira alimenta. É só pra seta de alta/queda, então sai de graça (leitura de
   * banco, sem rede) e some sozinho quando não há dado: `previousClose` nulo já significa "não
   * desenha seta" no frontend.
   */
  private async previousCloses(assets: { class: InvestmentAssetClass; ticker: string }[]): Promise<Map<string, number>> {
    const tickers = assets.map((a) => storageTicker(a.class, a.ticker));
    const hoje = todayInBrazil(new Date());
    const desde = new Date(hoje.getTime() - PREVIOUS_CLOSE_LOOKBACK_DAYS * 86_400_000);

    const rows = await this.prisma.historicalPrice.findMany({
      where: { ticker: { in: tickers }, date: { gte: desde, lt: hoje } },
      orderBy: { date: "asc" },
    });

    // Ordenado por data crescente, a última escrita de cada ticker é a mais recente.
    const ultimo = new Map<string, number>();
    for (const row of rows) ultimo.set(row.ticker, Number(row.close));
    return ultimo;
  }
}
