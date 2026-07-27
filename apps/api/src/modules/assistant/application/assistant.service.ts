import { Injectable, InternalServerErrorException, Logger, ServiceUnavailableException } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { CardsService } from "../../cards/application/cards.service";
import { CalendarService } from "../../calendar/calendar.service";
import { HouseholdDashboardService } from "../../household/application/household-dashboard.service";
import { InvestmentsDashboardService } from "../../investments/application/investments-dashboard.service";
import { TrackingDashboardService } from "../../tracking/application/tracking-dashboard.service";

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
    private readonly trackingDashboard: TrackingDashboardService,
  ) {}

  async chat(userId: string, history: ChatMessage[]): Promise<ChatMessage[]> {
    if (!this.client) {
      throw new ServiceUnavailableException("Assistente não configurado — falta ANTHROPIC_API_KEY no servidor.");
    }

    const messages: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
    const tools = this.buildTools();

    try {
      let finalText = "";

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await this.client.messages.create({
          model: MODEL,
          max_tokens: 2048,
          system: this.buildSystemPrompt(),
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

  private buildSystemPrompt(): string {
    const hoje = new Date().toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
    return [
      'Você é o assistente financeiro pessoal dentro do app "Ferramentas do Mauro".',
      `Hoje é ${hoje}.`,
      "Responda em português do Brasil, de forma direta e objetiva — sem enrolação.",
      "Use as ferramentas disponíveis pra consultar dados reais do usuário antes de responder qualquer pergunta sobre valores, cartões, contas ou investimentos. Nunca invente número.",
      "Se nenhuma ferramenta responder exatamente o que foi perguntado, diga isso claramente em vez de chutar.",
      "Valores monetários sempre em reais, formatados como 1.234,56.",
      'No Parcelamento, o "mês" de uma parcela é a competência (mês em que a fatura fecha, convenção dos bancos) — pode ser diferente do mês em que ela realmente vence. Não precisa explicar essa diferença a menos que o usuário pergunte especificamente sobre isso.',
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
      default:
        return { error: `Ferramenta desconhecida: ${name}` };
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
