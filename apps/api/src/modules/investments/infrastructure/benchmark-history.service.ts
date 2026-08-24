import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { DatedClose } from "../domain/portfolio-evolution";

export type BenchmarkKey = "IBOV" | "IFIX";

type BenchmarkSource = "brapi" | "yahoo";

interface BenchmarkCandidate {
  source: BenchmarkSource;
  symbol: string;
}

/**
 * Ibovespa e IFIX não são ativos da carteira, então não passam pelo MarketPriceService: o que
 * interessa deles é só a série de fechamentos.
 *
 * **BRAPI primeiro, Yahoo como reserva.** A ordem já foi a inversa e não funcionou em produção: o
 * Yahoo devolve **429 em tudo** para o IP da VPS (conferido em 2026-08-23 — `^BVSP`, `^IFIX` e
 * `IFIX.SA`, todos "Too Many Requests"), enquanto a BRAPI responde os dois com token, que a API já
 * tem. Faixa de datacenter tomando rate limit do Yahoo é comum e não tem conserto do nosso lado.
 *
 * Os símbolos alternativos continuam existindo porque a cobertura varia entre as fontes: a BRAPI
 * normaliza `IFIX` para `IFIX.SA` sozinha, e o Yahoo usa `^` nos índices. A primeira que responder
 * ganha, e o par fonte+símbolo fica memorizado pra não repetir os que já falharam.
 */
const BENCHMARK_SYMBOLS: Record<BenchmarkKey, { ticker: string; label: string; candidates: BenchmarkCandidate[] }> = {
  IBOV: {
    ticker: "^BVSP",
    label: "Ibovespa",
    candidates: [
      { source: "brapi", symbol: "^BVSP" },
      { source: "yahoo", symbol: "^BVSP" },
    ],
  },
  IFIX: {
    ticker: "^IFIX",
    label: "IFIX",
    candidates: [
      { source: "brapi", symbol: "IFIX" },
      { source: "brapi", symbol: "IFIX.SA" },
      { source: "yahoo", symbol: "^IFIX" },
      { source: "yahoo", symbol: "IFIX.SA" },
    ],
  },
};

/** A ponta da série é a única parte que muda; o resto é histórico imutável, igual ao CDI diário. */
const TAIL_TTL_MS = 60 * 60 * 1000;

/**
 * Abaixo disso a resposta não é uma série, é um ponto solto — e ponto solto é pior que nada aqui.
 *
 * Foi o que aconteceu com o IFIX em produção: a BRAPI devolveu **1 fechamento** (o IBOV veio com
 * 64 no mesmo pedido), o candidato passou no antigo `length > 0`, ficou memorizado como "esse
 * funciona" e os outros nunca foram tentados. No gráfico isso vira uma reta em 0% no trecho final,
 * que se lê como "o índice não andou" em vez de "não temos o dado".
 */
const MIN_SERIES_POINTS = 5;

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

interface BrapiQuoteResponse {
  results?: {
    historicalDataPrice?: { date?: number; close?: number; adjustedClose?: number }[];
  }[];
}

/** Yahoo e BRAPI usam o mesmo vocabulário de `range`, então um mapeamento serve pras duas. */
export function benchmarkRangeFor(days: number): string {
  if (days <= 32) return "3mo";
  if (days <= 95) return "6mo";
  if (days <= 190) return "1y";
  if (days <= 400) return "2y";
  if (days <= 1900) return "5y";
  return "10y";
}

/**
 * Fechamento vindo de um timestamp unix (as duas fontes publicam assim).
 *
 * Feriado vem como `null` no meio da série; pular é o certo, gravar zero contaminaria o histórico
 * com um dia em que o índice "foi a zero" — e como isso vai pro banco, o erro seria permanente.
 */
function toDatedClose(timestamp: number | undefined, close: number | null | undefined): DatedClose | null {
  if (typeof timestamp !== "number" || typeof close !== "number" || !Number.isFinite(close)) return null;
  return { date: new Date(timestamp * 1000).toISOString().slice(0, 10), close };
}

/** Payload do `/api/quote/{símbolo}?range=&interval=1d` da BRAPI. */
export function parseBrapiHistory(body: BrapiQuoteResponse): DatedClose[] {
  const pontos = body.results?.[0]?.historicalDataPrice ?? [];
  return pontos
    .map((p) => toDatedClose(p.date, p.adjustedClose ?? p.close))
    .filter((p): p is DatedClose => p !== null);
}

/** Payload do `/v8/finance/chart/{símbolo}` do Yahoo. */
export function parseYahooHistory(body: YahooChartResponse): DatedClose[] {
  const result = body.chart.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  return timestamps
    .map((t, i) => toDatedClose(t, closes[i]))
    .filter((p): p is DatedClose => p !== null);
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
  /** Fonte+símbolo que funcionou da última vez — evita repetir os candidatos que já falharam. */
  private readonly resolved = new Map<BenchmarkKey, BenchmarkCandidate>();

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
    // O TTL vale TAMBÉM quando não há nada guardado — era o furo: com a fonte fora do ar o banco
    // ficava vazio pra sempre, `faltaComeco` nunca deixava de ser verdade, e cada abertura da
    // Carteira recomeçava a fila de candidatos contra um provedor morto. Quatro símbolos × 8s de
    // timeout é o gráfico inteiro esperando por uma linha que não vai vir. Mesma lição da
    // quarentena da cotação: insistir num provedor que acabou de estourar só entrega o timeout
    // de novo, agora com o usuário parado olhando pra tela.
    if (Date.now() - (this.lastTailFetch.get(key) ?? 0) < TAIL_TTL_MS) return;

    this.lastTailFetch.set(key, Date.now());

    const dias = Math.max(1, Math.round((Date.now() - inicioPedido.getTime()) / 86_400_000));
    const pontos = await this.fetch(key, benchmarkRangeFor(dias));
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
    const conhecido = this.resolved.get(key);
    const todos = BENCHMARK_SYMBOLS[key].candidates;
    const candidatos = conhecido
      ? [conhecido, ...todos.filter((c) => c.source !== conhecido.source || c.symbol !== conhecido.symbol)]
      : todos;

    for (const candidato of candidatos) {
      try {
        const pontos =
          candidato.source === "brapi"
            ? await this.fetchBrapi(candidato.symbol, range)
            : await this.fetchYahoo(candidato.symbol, range);

        if (pontos.length >= MIN_SERIES_POINTS) {
          this.resolved.set(key, candidato);
          return pontos;
        }
        if (pontos.length > 0) {
          this.logger.warn(
            `${key}: ${candidato.source} ${candidato.symbol} devolveu só ${pontos.length} ponto(s) — não dá série, tentando o próximo`,
          );
        }
      } catch (err) {
        this.logger.warn(`${key}: ${candidato.source} ${candidato.symbol} falhou (${(err as Error).message})`);
      }
    }

    this.logger.warn(`${key}: nenhuma fonte respondeu — a comparação fica sem essa linha`);
    return [];
  }

  private async fetchBrapi(symbol: string, range: string): Promise<DatedClose[]> {
    const token = process.env.BRAPI_TOKEN;
    const url = `https://brapi.dev/api/quote/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    return parseBrapiHistory((await res.json()) as BrapiQuoteResponse);
  }

  private async fetchYahoo(symbol: string, range: string): Promise<DatedClose[]> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": YAHOO_USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const body = (await res.json()) as YahooChartResponse;
    if (body.chart.error) throw new Error(body.chart.error.description ?? body.chart.error.code ?? "erro");

    return parseYahooHistory(body);
  }
}
