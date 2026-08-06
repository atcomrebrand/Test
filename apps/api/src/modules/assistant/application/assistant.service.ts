import { Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { CardsService } from "../../cards/application/cards.service";
import { CalendarService } from "../../calendar/calendar.service";
import { HouseholdDashboardService } from "../../household/application/household-dashboard.service";
import { InvestmentsDashboardService } from "../../investments/application/investments-dashboard.service";
import { MarketExplorerService } from "../../investments/application/market-explorer.service";
import { DividendsService } from "../../investments/application/dividends.service";
import { TrackingDashboardService } from "../../tracking/application/tracking-dashboard.service";
import { QuotesService } from "../../quotes/quotes.service";
import { FinancingsService } from "../../financings/application/financings.service";
import { HomeDashboardService } from "../../home/application/home-dashboard.service";
import { AssistantMemoryService } from "../../assistant-memory/application/assistant-memory.service";
import { MarketService } from "../../market/application/market.service";
import { searchProducts } from "../../market/domain/product-search";

type AssetClasseUsuario = "ACAO" | "FII" | "CRIPTO";

const CLASSE_USUARIO_PARA_INTERNA: Record<AssetClasseUsuario, "STOCK" | "FII" | "CRYPTO"> = {
  ACAO: "STOCK",
  FII: "FII",
  CRIPTO: "CRYPTO",
};

const MODEL = "claude-haiku-4-5";
const MAX_TOOL_ROUNDS = 6;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Chat assistente do app — responde perguntas sobre os dados financeiros do próprio usuário
 * consultando os services já existentes de cada módulo via tool use, nunca inventando números.
 * Stateless: o cliente reenvia o histórico completo (texto puro) a cada pergunta; os blocos
 * internos de tool_use/tool_result de cada rodada existem só durante esta requisição.
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private readonly client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

  constructor(
    private readonly cards: CardsService,
    private readonly calendar: CalendarService,
    private readonly householdDashboard: HouseholdDashboardService,
    private readonly investmentsDashboard: InvestmentsDashboardService,
    private readonly marketExplorer: MarketExplorerService,
    private readonly dividends: DividendsService,
    private readonly trackingDashboard: TrackingDashboardService,
    private readonly quotes: QuotesService,
    private readonly financings: FinancingsService,
    private readonly homeDashboard: HomeDashboardService,
    private readonly assistantMemory: AssistantMemoryService,
    private readonly market: MarketService,
  ) {}

  async chat(userId: string, history: ChatMessage[]): Promise<ChatMessage[]> {
    if (!this.client) {
      throw new ServiceUnavailableException("Assistente não configurado — falta ANTHROPIC_API_KEY no servidor.");
    }

    const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
    const tools = this.buildTools();
    // Buscado uma vez por conversa (não a cada rodada) — memórias criadas por essa mesma conversa
    // via lembrar/esquecer só passam a valer na próxima vez que o usuário mandar mensagem, o que é
    // aceitável: dentro da mesma rodada de tool use o assistente já sabe o que acabou de salvar
    // pelo próprio tool_result, não precisa reler do banco.
    const memories = await this.assistantMemory.findAll(userId);
    const system = this.buildSystemPrompt(memories);

    try {
      let finalText = "";

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await this.client.messages.create({
          model: MODEL,
          max_tokens: 2048,
          system,
          tools,
          messages,
        });

        messages.push({ role: "assistant", content: response.content });

        if (response.stop_reason !== "tool_use") {
          finalText = response.content
            .filter((b): b is Anthropic.TextBlock => b.type === "text")
            .map((b) => b.text)
            .join("\n\n");
          break;
        }

        const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of toolUses) {
          const result = await this.runTool(userId, block.name, (block.input ?? {}) as Record<string, unknown>);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) });
        }
        messages.push({ role: "user", content: toolResults });
      }

      return [...history, { role: "assistant", content: finalText || "Não consegui gerar uma resposta — tenta reformular a pergunta." }];
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) {
        throw new ServiceUnavailableException("Chave da API da Anthropic inválida ou expirada.");
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new ServiceUnavailableException("Limite de uso da API atingido — tenta de novo daqui a pouco.");
      }
      if (err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message)) {
        throw new ServiceUnavailableException(
          "Sem créditos na conta da Anthropic — adicione créditos em console.anthropic.com (Plans & Billing) pra voltar a usar o assistente.",
        );
      }
      this.logger.error("Erro ao consultar o assistente", err as Error);
      throw new InternalServerErrorException("Erro ao consultar o assistente.");
    }
  }

  private buildSystemPrompt(memories: { id: string; content: string }[]): string {
    const hoje = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
    const memoriasTexto =
      memories.length > 0 ? memories.map((m) => `- (id: ${m.id}) ${m.content}`).join("\n") : "Nenhuma memória salva ainda pra esse usuário.";

    return [
      'Você é o assistente financeiro pessoal dentro do app "Ferramentas do Mauro".',
      `Hoje é ${hoje}.`,
      "Responda em português do Brasil impecável, com gramática, concordância e acentuação corretas, de forma direta e objetiva, sem enrolação.",
      "Suas respostas costumam ser lidas em voz alta por um sintetizador de fala, então escreva sempre pensando em fluidez de fala, nunca em texto formatado para tela:",
      "Não use nenhum tipo de marcação: sem asteriscos, sem hífen ou marcador de lista, sem cerquilha, sem numeração de lista, sem tabela. Escreva só em frases corridas, como se estivesse falando com a pessoa.",
      "Escreva todo número por extenso, nunca como numeral ou símbolo: valores em dinheiro, quantidades, percentuais, datas e horas sempre em palavras (por exemplo, cento e vinte e três reais e quarenta centavos em vez de R$ 123,40; três vírgula cinco por cento em vez de 3,5%; quinze de agosto em vez de 15/08; duas e meia da tarde em vez de 14:30).",
      "Use as ferramentas disponíveis pra consultar dados reais do usuário antes de responder qualquer pergunta sobre valores, cartões, contas ou investimentos. Nunca invente número.",
      "Se nenhuma ferramenta responder exatamente o que foi perguntado, diga isso claramente em vez de chutar.",
      'No Parcelamento, o "mês" de uma parcela é a competência (mês em que a fatura fecha, convenção dos bancos) — pode ser diferente do mês em que ela realmente vence. Não precisa explicar essa diferença a menos que o usuário pergunte especificamente sobre isso.',
      "Pra perguntas sobre uma ação, FII ou criptomoeda específica (cotação, preço sobre lucro, dividend yield, indicadores, próximos proventos), use as ferramentas de cotação e análise de ativos mesmo que o usuário não tenha esse ativo na carteira — elas consultam qualquer ativo do mercado. Pra cotação do dólar, use a ferramenta de cotação do dólar.",
      "No Mercado, o valor de tributos vem da linha que a Lei 12.741 obriga o supermercado a imprimir na nota, calculada por tabela de referência — é aproximado, não é o imposto exato que a loja recolheu. Sempre que falar desse número, diga que é aproximado. E repare no campo que diz em quantas notas o tributo foi declarado: se não foi em todas, o total é um piso, não o imposto de tudo que foi comprado — deixe isso claro em vez de apresentar como se cobrisse tudo.",
      "Pra perguntas que cruzam vários assuntos de uma vez (por exemplo, comparar quitar um financiamento usando os investimentos, decidir entre refinanciar ou não, ou entender a saúde financeira geral), comece pela ferramenta de visão geral financeira e complemente com resumo_financiamentos e/ou resumo_investimentos pra ter os números certos antes de opinar. Depois de ter os dados, dê sua opinião fundamentada nos números — o usuário quer sua análise, não só os números de volta.",
      "",
      "Memórias que esse usuário já pediu pra você guardar sobre ele — fatos, crenças, valores, prioridades, jeito que prefere ser tratado. Leve sempre em conta ao responder e ao dar opiniões, sem precisar que ele repita:",
      memoriasTexto,
      "Use a ferramenta lembrar sempre que o usuário disser algo sobre si mesmo que vale guardar pra sempre — uma crença, um valor, uma prioridade financeira, uma forma que ele prefere que você trate certos assuntos — mesmo que ele não peça explicitamente pra você lembrar. Não guarde fatos financeiros que já vivem nos dados do app (esses você já consulta pelas outras ferramentas) nem coisas triviais de uma pergunta só. Use esquecer quando o usuário disser que uma memória não vale mais ou pedir explicitamente pra esquecer algo — use o id exato listado acima.",
    ].join("\n");
  }

  private buildTools(): Anthropic.Tool[] {
    return [
      {
        name: "resumo_parcelamento_mes",
        description:
          "Total de parcelas do módulo Parcelamento numa competência (mês) específica: valor total, quantidade de parcelas e detalhamento por cartão. Use pra perguntas como 'quanto vou pagar em [mês]' ou 'quanto gastei em [mês]' no cartão de crédito.",
        input_schema: {
          type: "object",
          properties: {
            year: { type: "integer", description: "Ano, ex: 2026" },
            month: { type: "integer", description: "Mês, de 1 a 12" },
          },
          required: ["year", "month"],
        },
      },
      {
        name: "resumo_parcelamento_ano",
        description: "Totais mês a mês do Parcelamento pra um ano inteiro — útil pra comparar meses ou ver tendência ao longo do ano.",
        input_schema: {
          type: "object",
          properties: { year: { type: "integer", description: "Ano, ex: 2026" } },
          required: ["year"],
        },
      },
      {
        name: "listar_cartoes_parcelamento",
        description: "Lista os cartões de crédito cadastrados no módulo Parcelamento, com banco, dia de fechamento, dia de vencimento e limite.",
        input_schema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "dashboard_casa_mes",
        description:
          "Dashboard completo da Casa (orçamento doméstico) pra um mês: total de entradas, contas, cartões, saldo livre, contas atrasadas/a vencer, taxa de poupança.",
        input_schema: {
          type: "object",
          properties: {
            year: { type: "integer", description: "Ano, ex: 2026" },
            month: { type: "integer", description: "Mês, de 1 a 12" },
          },
          required: ["year", "month"],
        },
      },
      {
        name: "resumo_investimentos",
        description:
          "Resumo completo da carteira de investimentos: patrimônio total, valor investido, lucro líquido, rentabilidade, distribuição por categoria, maiores ganhos/perdas, próximos vencimentos de renda fixa.",
        input_schema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "resumo_horas",
        description:
          "Dashboard do módulo Horas (controle de ponto/trabalhos): horas trabalhadas hoje e no mês, receita de trabalhos fixos/freelance/outras entradas, valor médio da hora, dias trabalhados, próximo pagamento, comparação com o mês anterior. Use pra perguntas sobre horas trabalhadas, faturamento de trabalho/freela ou valor da hora.",
        input_schema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "cotacao_dolar",
        description: "Cotação atual do dólar (USD/BRL) e o fechamento do pregão anterior, pra comparar se subiu ou caiu.",
        input_schema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "cotacao_ativo",
        description:
          "Cotação atual e indicadores básicos (preço, variação do dia, preço sobre lucro, dividend yield, volume) de uma ação, FII ou criptomoeda específica pelo ticker/símbolo — funciona pra qualquer ativo do mercado, esteja ou não na carteira do usuário. Use pra perguntas como 'quanto está a PETR4' ou 'qual o preço do bitcoin agora'.",
        input_schema: {
          type: "object",
          properties: {
            ticker: { type: "string", description: "Ticker/símbolo do ativo, ex: PETR4, MXRF11, BTC" },
            classe: { type: "string", enum: ["ACAO", "FII", "CRIPTO"], description: "Classe do ativo" },
          },
          required: ["ticker", "classe"],
        },
      },
      {
        name: "analise_ativo",
        description:
          "Indicadores fundamentalistas completos de uma ação ou FII pelo ticker: preço sobre lucro, preço sobre valor patrimonial, dividend yield, margens, ROE, endividamento, preço-teto de Graham e de Bazin, e os próximos proventos anunciados desse ativo. Não se aplica a criptomoeda. Use pra perguntas sobre se um ativo está caro/barato ou sobre seus indicadores fundamentalistas.",
        input_schema: {
          type: "object",
          properties: {
            ticker: { type: "string", description: "Ticker do ativo, ex: PETR4, MXRF11" },
            classe: { type: "string", enum: ["ACAO", "FII"], description: "Classe do ativo" },
          },
          required: ["ticker", "classe"],
        },
      },
      {
        name: "resumo_financiamentos",
        description:
          "Financiamentos do usuário (carro, moto, imóvel etc, fora do Parcelamento): lista completa com valor total do contrato, valor e quantidade de parcelas, quantas já foram pagas, quanto ainda falta em parcelas, e a última cotação de quitação à vista (quanto o banco cobraria pra quitar hoje) quando o usuário já registrou uma. Use pra qualquer pergunta sobre financiamento, empréstimo, quitação antecipada ou refinanciamento.",
        input_schema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "visao_geral_financeira",
        description:
          "Visão cruzada de todos os módulos: patrimônio investido menos dívida de financiamento (pela cotação de quitação à vista), renda/comprometido/sobra do mês (baseados na Casa), rentabilidade de renda fixa/variável/total, uso de limite de cartão, e uma previsão simples pro próximo mês. Use como ponto de partida pra perguntas que cruzam vários assuntos de uma vez — por exemplo, comparar quitar um financiamento usando os investimentos, ou entender a saúde financeira geral —, e complemente com resumo_investimentos ou resumo_financiamentos se precisar de mais detalhe.",
        input_schema: { type: "object", properties: {}, required: [] },
      },
      {
        name: "proventos_futuros",
        description:
          "Lista dos próximos dividendos/proventos ainda não pagos. Com escopo 'carteira' (padrão), traz só os ativos que o usuário possui, já com a quantidade em posição e o valor estimado a receber. Com escopo 'mercado', traz os próximos proventos anunciados pelas principais ações e FIIs da bolsa, independente do que o usuário possui. Use pra perguntas como 'quando cai o próximo dividendo' ou 'quanto vou receber de provento'.",
        input_schema: {
          type: "object",
          properties: {
            escopo: { type: "string", enum: ["carteira", "mercado"], description: "carteira = só ativos do usuário; mercado = principais ativos da bolsa" },
          },
          required: [],
        },
      },
      {
        name: "resumo_mercado",
        description:
          "Gasto de supermercado no módulo Mercado: total gasto, total de tributos declarados nas notas, alíquota efetiva e quebra mês a mês. Use pra perguntas como 'quanto gastei de mercado', 'quanto paguei de imposto no supermercado' ou 'meu gasto de mercado subiu?'. Sem datas, devolve o histórico todo.",
        input_schema: {
          type: "object",
          properties: {
            de: { type: "string", description: "Data inicial no formato AAAA-MM-DD. Opcional." },
            ate: { type: "string", description: "Data final no formato AAAA-MM-DD. Opcional." },
          },
          required: [],
        },
      },
      {
        name: "compras_mercado",
        description:
          "Lista as compras de supermercado já importadas, da mais recente pra mais antiga: mercado, data, valor e quantidade de itens. Use pra perguntas como 'quando foi minha última compra' ou 'em que mercado eu compro mais'.",
        input_schema: {
          type: "object",
          properties: {
            de: { type: "string", description: "Data inicial no formato AAAA-MM-DD. Opcional." },
            ate: { type: "string", description: "Data final no formato AAAA-MM-DD. Opcional." },
          },
          required: [],
        },
      },
      {
        name: "preco_produto_mercado",
        description:
          "Histórico de preço de um produto de supermercado que o usuário já comprou: último preço, variação desde a primeira compra, preço médio, menor e maior preço, em que mercado saiu mais barato e cada compra individual. Use pra perguntas como 'quanto tá o arroz', 'o café subiu de preço?' ou 'onde compro leite mais barato'. Busca pelo nome, sem precisar acertar exatamente como está escrito na nota.",
        input_schema: {
          type: "object",
          properties: { produto: { type: "string", description: "Nome ou parte do nome do produto, ex: 'café', 'arroz tio joão'" } },
          required: ["produto"],
        },
      },
      {
        name: "lembrar",
        description:
          "Salva permanentemente um fato, crença, valor ou preferência do usuário, pra levar em conta em toda conversa futura, não só nessa. Use sempre que o usuário disser algo sobre si mesmo que vale guardar — por exemplo como prefere ser tratado, uma prioridade financeira, uma crença ou valor pessoal — mesmo sem ele pedir explicitamente.",
        input_schema: {
          type: "object",
          properties: {
            conteudo: { type: "string", description: "O fato/crença/preferência a guardar, escrito de forma clara e independente de contexto, ex: 'prefere respostas diretas, sem rodeio' ou 'prioriza quitar dívidas rápido em vez de maximizar investimento'." },
          },
          required: ["conteudo"],
        },
      },
      {
        name: "esquecer",
        description: "Apaga uma memória salva anteriormente, pelo id exato listado nas memórias do usuário. Use quando o usuário disser que algo não vale mais ou pedir explicitamente pra esquecer.",
        input_schema: {
          type: "object",
          properties: { id: { type: "string", description: "id exato da memória, como listado no prompt do sistema" } },
          required: ["id"],
        },
      },
    ];
  }

  private async runTool(userId: string, name: string, input: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case "resumo_parcelamento_mes":
        return this.resumoParcelamentoMes(userId, Number(input.year), Number(input.month));
      case "resumo_parcelamento_ano":
        return this.calendar.year(userId, Number(input.year));
      case "listar_cartoes_parcelamento":
        return this.listarCartoes(userId);
      case "dashboard_casa_mes":
        return this.householdDashboard.month(userId, Number(input.year), Number(input.month));
      case "resumo_investimentos":
        return this.investmentsDashboard.summary(userId);
      case "resumo_horas":
        return this.trackingDashboard.summary(userId);
      case "cotacao_dolar":
        return this.cotacaoDolar();
      case "cotacao_ativo":
        return this.cotacaoAtivo(userId, String(input.ticker), input.classe as AssetClasseUsuario);
      case "analise_ativo":
        return this.analiseAtivo(String(input.ticker), input.classe as AssetClasseUsuario);
      case "proventos_futuros":
        return this.proventosFuturos(userId, (input.escopo as "carteira" | "mercado" | undefined) ?? "carteira");
      case "resumo_financiamentos":
        return this.resumoFinanciamentos(userId);
      case "visao_geral_financeira":
        return this.visaoGeralFinanceira(userId);
      case "resumo_mercado":
        return this.market.getSpendingSummary(userId, input.de as string | undefined, input.ate as string | undefined);
      case "compras_mercado":
        return this.comprasMercado(userId, input.de as string | undefined, input.ate as string | undefined);
      case "preco_produto_mercado":
        return this.precoProdutoMercado(userId, String(input.produto));
      case "lembrar":
        return this.lembrar(userId, String(input.conteudo));
      case "esquecer":
        return this.esquecer(userId, String(input.id));
      default:
        return { error: `Ferramenta desconhecida: ${name}` };
    }
  }

  /** Recorta o que a lista de compras traz: id e chave da nota não ajudam a responder nada em voz
   *  alta, e as 44 dígitos da chave sozinhas comeriam mais tokens que o resto da resposta. */
  private async comprasMercado(userId: string, de?: string, ate?: string) {
    const compras = await this.market.listPurchases(userId, de, ate);
    if (compras.length === 0) return { compras: [], aviso: "Nenhuma compra de mercado importada nesse período." };
    return {
      compras: compras.map((c) => ({
        mercado: c.storeName,
        data: c.purchaseDate.toISOString().slice(0, 10),
        total: c.totalAmount,
        tributos: c.taxAmount,
        itens: c.itemCount,
      })),
    };
  }

  private async precoProdutoMercado(userId: string, termo: string) {
    const produtos = await this.market.listProducts(userId);
    const achados = searchProducts(produtos, termo);

    if (achados.length === 0) {
      return { error: `Não achei nenhum produto parecido com "${termo}" nas compras de mercado importadas.` };
    }

    const detalhe = await this.market.getProduct(userId, achados[0].id);
    return {
      produto: detalhe.name,
      unidade: detalhe.unit,
      resumo: detalhe.summary,
      historico: detalhe.history,
      // O assistente precisa saber que houve escolha pra poder oferecer as outras se errou o alvo.
      outrosParecidos: achados.slice(1).map((p) => p.name),
    };
  }

  private async cotacaoDolar() {
    const [usd] = await this.quotes.ticker();
    if (!usd || usd.rate === null) return { error: "Cotação do dólar indisponível no momento." };
    return { moeda: "USD/BRL", cotacao: usd.rate, fechamentoAnterior: usd.previousClose };
  }

  private async cotacaoAtivo(userId: string, ticker: string, classe: AssetClasseUsuario) {
    const classeInterna = CLASSE_USUARIO_PARA_INTERNA[classe];
    if (!classeInterna) return { error: `Classe de ativo inválida: ${classe}` };

    const result = await this.marketExplorer.getQuoteDetail(userId, classeInterna, ticker);
    if (!result.detail) return { error: `Não encontrei cotação pra ${ticker}.` };

    return {
      ticker: result.ticker,
      classe,
      preco: result.detail.price,
      moeda: result.detail.currency,
      variacaoPercentualHoje: result.detail.changePercent,
      aproximado: result.detail.approximate ?? false,
      indicadores: result.detail.fundamentals,
      naCarteiraDoUsuario: result.ownedAssetId !== null,
    };
  }

  private async analiseAtivo(ticker: string, classe: AssetClasseUsuario) {
    if (classe !== "ACAO" && classe !== "FII") return { error: "Análise fundamentalista só está disponível pra ações e FIIs." };
    const classeInterna = CLASSE_USUARIO_PARA_INTERNA[classe];

    const analysis = await this.marketExplorer.getAnalysis(classeInterna, ticker);
    if (!analysis) return { error: `Não encontrei dados pra ${ticker}.` };

    return {
      ticker: analysis.ticker,
      classe,
      precoAtual: analysis.currentPrice,
      variacaoPercentualHoje: analysis.changePercent,
      indicadores: analysis.indicators,
      precoTetoGraham: analysis.graham,
      precoTetoBazin: analysis.bazin,
      rentabilidade: analysis.profitability,
      proximosProventos: analysis.dividendsUpcoming.slice(0, 10),
    };
  }

  private async proventosFuturos(userId: string, escopo: "carteira" | "mercado") {
    const hoje = new Date();
    const calendar = escopo === "mercado" ? await this.dividends.getMarketCalendar() : await this.dividends.getPortfolioCalendar(userId);

    const futuros = calendar
      .filter((e) => (e.paymentDate ?? e.exDate ?? "") >= hoje.toISOString().slice(0, 10))
      .slice(0, 25)
      .map((e) => ({
        ticker: e.ticker,
        nome: e.name,
        tipo: e.type,
        dataCom: e.exDate,
        dataPagamento: e.paymentDate,
        valorPorAcaoOuCota: e.rate,
        quantidadeEmPosicao: e.quantityHeld,
        valorEstimadoAReceber: e.estimatedAmount,
      }));

    if (futuros.length === 0) {
      return { escopo, proventos: [], observacao: escopo === "carteira" ? "Nenhum provento futuro anunciado pros ativos da carteira." : "Nenhum provento futuro anunciado." };
    }
    return { escopo, proventos: futuros };
  }

  private async resumoFinanciamentos(userId: string) {
    const [financings, summary] = await Promise.all([this.financings.findAll(userId), this.financings.summary(userId)]);

    if (financings.length === 0) {
      return { observacao: "Nenhum financiamento cadastrado.", financiamentos: [] };
    }

    return {
      resumo: {
        totalAtivos: summary.totalActive,
        comprometidoMesAtual: summary.committedThisMonth,
        totalRestanteEmParcelas: summary.totalRemaining,
        totalJaPago: summary.totalPaid,
        proximaParcela: summary.nextInstallment,
      },
      financiamentos: financings.map((f) => {
        const pendentes = f.installments.filter((i) => i.status === "PENDING" || i.status === "LATE");
        const pagas = f.installments.filter((i) => i.status === "PAID");
        return {
          nome: f.name,
          tipo: f.kind,
          instituicao: f.institution,
          ativo: f.active,
          valorTotalContrato: Number(f.totalAmount),
          valorParcela: Number(f.installmentAmount),
          totalParcelas: f.installmentsCount,
          parcelasPagas: pagas.length,
          parcelasRestantes: pendentes.length,
          totalRestanteSomandoParcelas: Math.round(pendentes.reduce((sum, i) => sum + Number(i.amount), 0) * 100) / 100,
          cotacaoQuitacaoAVista: f.payoffAmount !== null ? Number(f.payoffAmount) : null,
          dataCotacaoQuitacao: f.payoffQuotedAt,
          observacoes: f.notes,
        };
      }),
    };
  }

  private async visaoGeralFinanceira(userId: string) {
    const d = await this.homeDashboard.summary(userId);
    return {
      patrimonioInvestidoMenosDividaDeFinanciamento: d.netWorth.netWorth,
      totalInvestido: d.netWorth.assets,
      dividaDeFinanciamentoPelaQuitacaoAVista: d.netWorth.debts,
      rendaDoMes: d.monthly.income,
      comprometidoNoMes: d.monthly.committed,
      sobraNoMes: d.monthly.freeBalance,
      taxaDePoupancaPercent: d.monthly.savingsRatePct,
      usoDeLimiteDeCartaoPercent: d.percentages.limitUsagePct,
      rentabilidadeRendaFixaPercent: d.percentages.fixedIncomeReturnPct,
      rentabilidadeVariavelPercent: d.percentages.variableReturnPct,
      rentabilidadeTotalPercent: d.percentages.investmentReturnPct,
      previsaoProximoMes: d.forecast.nextMonth,
      observacao:
        "Comprometido/sobra do mês são baseados só na Casa. Parcelas do cartão e financiamento não entram nessa soma — use resumo_parcelamento_mes e resumo_financiamentos pra detalhes deles.",
    };
  }

  private async lembrar(userId: string, conteudo: string) {
    if (!conteudo.trim()) return { error: "Conteúdo vazio — nada pra lembrar." };
    const memory = await this.assistantMemory.create(userId, conteudo);
    return { ok: true, id: memory.id, conteudo: memory.content };
  }

  private async esquecer(userId: string, id: string) {
    try {
      await this.assistantMemory.delete(userId, id);
      return { ok: true };
    } catch {
      return { error: "Não encontrei essa memória — confira o id." };
    }
  }

  private async resumoParcelamentoMes(userId: string, year: number, month: number) {
    const installments = await this.calendar.month(userId, year, month);
    const active = installments.filter((i) => i.status !== "CANCELLED");

    const byCard = new Map<string, { cartao: string; total: number; parcelas: number }>();
    for (const i of active) {
      const current = byCard.get(i.cardId) ?? { cartao: i.card.name, total: 0, parcelas: 0 };
      current.total += Number(i.amount);
      current.parcelas += 1;
      byCard.set(i.cardId, current);
    }

    return {
      referenceYear: year,
      referenceMonth: month,
      total: Math.round(active.reduce((sum, i) => sum + Number(i.amount), 0) * 100) / 100,
      parcelasCount: active.length,
      porCartao: Array.from(byCard.values()).map((c) => ({ ...c, total: Math.round(c.total * 100) / 100 })),
    };
  }

  private async listarCartoes(userId: string) {
    const cards = await this.cards.findAll(userId);
    return cards.map((c) => ({
      nome: c.name,
      banco: c.bank,
      fechaDia: c.closingDay,
      venceDia: c.dueDay,
      limite: Number(c.limitAmount),
      ativo: c.active,
    }));
  }
}
