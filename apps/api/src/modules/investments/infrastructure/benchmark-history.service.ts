import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { DatedClose } from "../domain/portfolio-evolution";

export type BenchmarkKey = "IBOV" | "IFIX";

/**
 * Ibovespa e IFIX não são ativos da carteira, então não passam pelo MarketPriceService: o que
 * interessa deles é só a série de fechamentos.
 *
 * Yahoo é o primeiro na fila porque índice não tem sufixo `.SA` — o provider de ações do módulo
 * cola esse sufixo em tudo, e `^BVSP.SA` não existe. Os símbolos alternativos existem porque a
 * cobertura de IFIX varia entre as fontes; a primeira que responder ganha.
 */
const BENCHMARK_SYMBOLS: Record<BenchmarkKey, { ticker: string; candidates: string[]; label: string }> = {
  IBOV: { ticker: "^BVSP", candidates: ["^BVSP"], label: "Ibovespa" },
  IFIX: { ticker: "^IFIX", candidates: ["^IFIX", "IFIX.SA", "IFIX"], label: "IFIX" },
};

/** A ponta da série é a única parte que muda; o resto é histórico imutável, igual ao CDI diário. */
const TAIL_TTL_MS = 60 * 60 * 1000;

const YAHOO_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

interface YahooChartResponse {
  chart: {
    result?: {
      timestamp?: number[];
      indicators?: { quote?: { close?: (number | null)[] }[] };
    }[];
    error?: { code?: string; description?: string } | null;
  };
}

function yahooRangeFor(days: number): string {
  if (days <= 32) return "3mo";
  if (days <= 95) return "6mo";
  if (days <= 190) return "1y";
  if (days <= 400) return "2y";
  if (days <= 1900) return "5y";
  return "10y";
}

/**
 * Fechamentos diários dos índices de referência, guardados em `historical_prices` — a mesma tabela
 * que o backfill do COTAHIST usa, porque é exatamente a mesma coisa: fechamento de um dia que já
 * passou e nunca mais muda. `^BVSP`/`^IFIX` não colidem com ticker nenhum de ação, e o
 * `getArchivedHistory` do MarketPriceService só consulta os tickers dos ativos do usuário.
 *
 * Nada aqui lança: índice fora do ar devolve série vazia, o gráfico simplesmente não desenha
 * aquela linha e as outras continuam. Um erro de comparação não pode derrubar a tela que mostra
 * o patrimônio.
 */
@Injectable()
export class BenchmarkHistoryService {
  private readonly logger = new Logger(BenchmarkHistoryService.name);
  private readonly lastTailFetch = new Map<BenchmarkKey, number>();
  /** Símbolo que funcionou da última vez — evita repetir os candidatos que já falharam. */
  private readonly resolvedSymbol = new Map<BenchmarkKey, string>();

  constructor(private readonly prisma: PrismaService) {}

  static label(key: BenchmarkKey): string {
    return BENCHMARK_SYMBOLS[key].label;
  }

  async getSeries(key: BenchmarkKey, from: string, to: string): Promise<DatedClose[]> {
    await this.ensureCovers(key, from, to);

    const rows = await this.prisma.historicalPrice.findMany({
      where: {
        ticker: BENCHMARK_SYMBOLS[key].ticker,
        date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T00:00:00Z`) },
      },
      orderBy: { date: "asc" },
    });

    // Mesmo motivo do AssetHistoryService: janela começando em fim de semana ou feriado precisa do
    // último fechamento anterior, senão a base 100 do índice sai do primeiro pregão da semana e a
    // comparação começa deslocada em relação às linhas da carteira.
    const anterior = await this.prisma.historicalPrice.findFirst({
      where: { ticker: BENCHMARK_SYMBOLS[key].ticker, date: { lt: new Date(`${from}T00:00:00Z`) } },
      orderBy: { date: "desc" },
    });

    const serie = rows.map((r) => ({ date: r.date.toISOString().slice(0, 10), close: Number(r.close) }));
    if (!anterior) return serie;
    return [{ date: anterior.date.toISOString().slice(0, 10), close: Number(anterior.close) }, ...serie];
  }

  private async ensureCovers(key: BenchmarkKey, from: string, to: string): Promise<void> {
    const ticker = BENCHMARK_SYMBOLS[key].ticker;
    const [primeira, ultima] = await Promise.all([
      this.prisma.historicalPrice.findFirst({ where: { ticker }, orderBy: { date: "asc" } }),
      this.prisma.historicalPrice.findFirst({ where: { ticker }, orderBy: { date: "desc" } }),
    ]);

    const inicioPedido = new Date(`${from}T00:00:00Z`);
    const fimPedido = new Date(`${to}T00:00:00Z`);
    const faltaComeco = !primeira || primeira.date.getTime() > inicioPedido.getTime();
    const faltaPonta = !ultima || ultima.date.getTime() < fimPedido.getTime();

    if (!faltaComeco && !faltaPonta) return;
    if (!faltaComeco && Date.now() - (this.lastTailFetch.get(key) ?? 0) < TAIL_TTL_MS) return;

    this.lastTailFetch.set(key, Date.now());

    const dias = Math.max(1, Math.round((Date.now() - inicioPedido.getTime()) / 86_400_000));
    const pontos = await this.fetch(key, yahooRangeFor(dias));
    if (pontos.length === 0) return;

    // skipDuplicates + unique (ticker, date): duas telas abrindo juntas trazem os mesmos dias, e
    // isso resolve a corrida sem transformar concorrência em erro 500.
    await this.prisma.historicalPrice.createMany({
      data: pontos.map((p) => ({ ticker, date: new Date(`${p.date}T00:00:00Z`), close: p.close })),
      skipDuplicates: true,
    });
    this.logger.log(`${key}: ${pontos.length} fechamento(s) guardado(s)`);
  }

  private async fetch(key: BenchmarkKey, range: string): Promise<DatedClose[]> {
    const conhecido = this.resolvedSymbol.get(key);
    const candidatos = conhecido
      ? [conhecido, ...BENCHMARK_SYMBOLS[key].candidates.filter((s) => s !== conhecido)]
      : BENCHMARK_SYMBOLS[key].candidates;

    for (const symbol of candidatos) {
      try {
        const pontos = await this.fetchYahoo(symbol, range);
        if (pontos.length > 0) {
          this.resolvedSymbol.set(key, symbol);
          return pontos;
        }
      } catch (err) {
        this.logger.warn(`${key}: ${symbol} falhou (${(err as Error).message})`);
      }
    }

    this.logger.warn(`${key}: nenhum símbolo respondeu — a comparação fica sem essa linha`);
    return [];
  }

  private async fetchYahoo(symbol: string, range: string): Promise<DatedClose[]> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": YAHOO_USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const body = (await res.json()) as YahooChartResponse;
    if (body.chart.error) throw new Error(body.chart.error.description ?? body.chart.error.code ?? "erro");

    const result = body.chart.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];

    const pontos: DatedClose[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      // Feriado vem como null no meio da série — pular é o certo, gravar zero contaminaria o
      // histórico com um dia em que o índice "foi a zero".
      if (typeof close !== "number" || !Number.isFinite(close)) continue;
      pontos.push({ date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10), close });
    }
    return pontos;
  }
}
