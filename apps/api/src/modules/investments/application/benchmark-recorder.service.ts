import { Injectable, Logger } from "@nestjs/common";
import { Cron, Timeout } from "@nestjs/schedule";
import { BenchmarkHistoryService, BenchmarkKey } from "../infrastructure/benchmark-history.service";

const BENCHMARKS: BenchmarkKey[] = ["IBOV", "IFIX"];

/**
 * 22h UTC = 19h de Brasília, com o pregão da B3 já fechado (17h/18h) e o fechamento oficial
 * publicado. De segunda a sexta porque em fim de semana não há pregão — e mesmo que rodasse, a
 * cotação viria repetindo a sexta e o `resolveQuoteDate` descartaria.
 */
const APOS_O_PREGAO = "0 22 * * 1-5";

/**
 * Constrói a série dos índices de referência um pregão por vez.
 *
 * Existe porque o histórico do IFIX não está em fonte nenhuma que o app alcance: a BRAPI tem a
 * cotação dele mas devolve 1 ponto de série, e o Yahoo responde 429 pro IP da VPS (faixa de
 * datacenter tomando rate limit — não tem conserto do nosso lado). A cotação de hoje, essa,
 * funciona; então a série passa a ser construída daqui pra frente.
 *
 * O passado não volta, e o gráfico não finge que voltou: enquanto a série não cobrir o período
 * escolhido, o chip do índice continua desabilitado. Em três meses o período 3M fecha completo,
 * em um ano o 12M.
 *
 * O IBOV entra junto mesmo tendo histórico na BRAPI — é uma requisição por dia, e mantém a ponta
 * fresca sem depender de alguém abrir a tela.
 */
@Injectable()
export class BenchmarkRecorderService {
  private readonly logger = new Logger(BenchmarkRecorderService.name);

  constructor(private readonly benchmarks: BenchmarkHistoryService) {}

  @Cron(APOS_O_PREGAO)
  async recordAfterMarketClose(): Promise<void> {
    await this.record();
  }

  /**
   * Uma passada logo depois de subir, pra não ter que esperar o próximo pregão pra ver o efeito de
   * um deploy. Um minuto de atraso porque o banco e as conexões ainda estão se acomodando.
   */
  @Timeout(60_000)
  async recordOnStartup(): Promise<void> {
    await this.record();
  }

  private async record(): Promise<void> {
    for (const key of BENCHMARKS) {
      try {
        const resultado = await this.benchmarks.recordDailyClose(key);
        if (resultado === "gravado") this.logger.log(`${key}: fechamento do dia guardado`);
        else if (resultado === "sem-cotacao") this.logger.warn(`${key}: sem cotação pra guardar hoje`);
      } catch (err) {
        // Índice fora do ar não pode derrubar o job — o outro ainda tem que ser tentado.
        this.logger.warn(`${key}: falha ao guardar o fechamento (${(err as Error).message})`);
      }
    }
  }
}
