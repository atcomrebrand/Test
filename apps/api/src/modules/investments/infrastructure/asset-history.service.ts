import { Injectable, Logger } from "@nestjs/common";
import { InvestmentAssetClass } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { DatedClose } from "../domain/portfolio-evolution";
import { ChartRange } from "../domain/market-data.provider";
import { MarketPriceService } from "./market-price.service";

/** Idem CDI e índices: só a ponta muda, o resto é fechamento de dia que já passou. */
const TAIL_TTL_MS = 60 * 60 * 1000;

/**
 * Cripto vai pro banco com prefixo porque o namespace de `historical_prices` é compartilhado com o
 * backfill do COTAHIST (tickers da B3). "BTC" hoje não colide com nada, mas o dia em que colidir
 * seria um gráfico silenciosamente errado — o prefixo custa nada e fecha a porta.
 */
function storageTicker(assetClass: InvestmentAssetClass, ticker: string): string {
  const upper = ticker.toUpperCase();
  return assetClass === "CRYPTO" ? `CRYPTO:${upper}` : upper;
}

function rangeFor(days: number): ChartRange {
  if (days <= 90) return "3M";
  if (days <= 180) return "6M";
  if (days <= 366) return "12M";
  return "MAX";
}

/**
 * Fechamentos diários dos ativos da carteira, guardados pra não precisar da rede duas vezes.
 *
 * O gráfico de evolução avalia a carteira inteira em ~100 datas, o que significa a série completa
 * de **todos** os ativos de uma vez. Com 18 tickers e 8s de timeout por requisição, buscar isso a
 * cada abertura de tela é a mesma armadilha que já derrubou a cotação — e o dado nem muda: o
 * fechamento de ontem é o mesmo pra sempre.
 *
 * Por isso a série mora em `historical_prices`, a mesma tabela do backfill do COTAHIST, e só a
 * ponta vai à rede (TTL de 1h por ativo). De quebra, o `getArchivedHistory` do MarketPriceService
 * passa a ter de onde tirar preço quando a BRAPI está fora do ar.
 *
 * Falha de rede nunca vira erro: devolve o que tiver no banco, nem que seja nada. Um gráfico
 * incompleto e avisado é melhor do que uma tela de patrimônio que não abre.
 */
@Injectable()
export class AssetHistoryService {
  private readonly logger = new Logger(AssetHistoryService.name);
  private readonly lastTailFetch = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly prices: MarketPriceService,
  ) {}

  async getSeries(
    asset: { class: InvestmentAssetClass; ticker: string },
    from: string,
    to: string,
  ): Promise<DatedClose[]> {
    const ticker = storageTicker(asset.class, asset.ticker);
    await this.ensureCovers(asset, ticker, from, to);

    const rows = await this.prisma.historicalPrice.findMany({
      where: { ticker, date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) } },
      orderBy: { date: "asc" },
    });

    // O fechamento anterior à janela entra SEMPRE, não só quando a janela vem vazia.
    //
    // Bug pego na verificação: com a janela começando num sábado, o primeiro fechamento dentro dela
    // é o da segunda — e os dois primeiros dias do gráfico caíam no preço médio, fazendo a carteira
    // "começar" valendo o custo e inventando uma alta artificial na segunda-feira. O último preço
    // conhecido antes do período é o que vale nesses dias, exatamente como no resto da série.
    const anterior = await this.prisma.historicalPrice.findFirst({
      where: { ticker, date: { lt: new Date(`${from}T00:00:00Z`) } },
      orderBy: { date: "desc" },
    });

    const serie = rows.map((r) => ({ date: r.date.toISOString().slice(0, 10), close: Number(r.close) }));
    if (!anterior) return serie;
    return [{ date: anterior.date.toISOString().slice(0, 10), close: Number(anterior.close) }, ...serie];
  }

  private async ensureCovers(
    asset: { class: InvestmentAssetClass; ticker: string },
    ticker: string,
    from: string,
    to: string,
  ): Promise<void> {
    const [primeira, ultima] = await Promise.all([
      this.prisma.historicalPrice.findFirst({ where: { ticker }, orderBy: { date: "asc" } }),
      this.prisma.historicalPrice.findFirst({ where: { ticker }, orderBy: { date: "desc" } }),
    ]);

    const inicio = new Date(`${from}T00:00:00Z`);
    const fim = new Date(`${to}T00:00:00Z`);
    const faltaComeco = !primeira || primeira.date.getTime() > inicio.getTime();
    const faltaPonta = !ultima || ultima.date.getTime() < fim.getTime();

    if (!faltaComeco && !faltaPonta) return;
    if (!faltaComeco && Date.now() - (this.lastTailFetch.get(ticker) ?? 0) < TAIL_TTL_MS) return;

    this.lastTailFetch.set(ticker, Date.now());

    const dias = Math.max(1, Math.round((Date.now() - inicio.getTime()) / 86_400_000));
    let pontos: DatedClose[] = [];
    try {
      pontos = await this.prices.getHistory(asset.class, asset.ticker, { range: rangeFor(dias) });
    } catch (err) {
      this.logger.warn(`Histórico de ${asset.ticker} falhou: ${(err as Error).message}`);
      return;
    }
    if (pontos.length === 0) return;

    await this.prisma.historicalPrice.createMany({
      data: pontos.map((p) => ({ ticker, date: new Date(`${p.date}T00:00:00Z`), close: p.close })),
      skipDuplicates: true,
    });
  }
}
