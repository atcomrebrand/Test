import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { FixedIncomesService } from "./fixed-incomes.service";

export interface CreatePortfolioInput {
  name: string;
  color?: string | null;
  notes?: string | null;
}

/**
 * Carteiras separadas dentro da mesma conta — o caso que motivou isto é cuidar do investimento de
 * um filho sem misturar com o próprio dinheiro.
 *
 * A carteira principal **não** é uma linha aqui: ela é o `portfolioId = null` das aplicações. Isso
 * mantém tudo que já existia em produção exatamente como estava, sem migrar dado nenhum, e faz o
 * isolamento acontecer por padrão em vez de por lembrança: quem não pede carteira recebe só a
 * principal.
 *
 * Por enquanto só renda fixa mora numa carteira separada. Ações e cripto continuam sendo da conta
 * inteira — quando isso mudar, é aqui que a coluna equivalente entra.
 */
@Injectable()
export class InvestmentPortfoliosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fixedIncomes: FixedIncomesService,
  ) {}

  /** As carteiras extras, cada uma já com o quanto tem dentro. */
  async list(userId: string) {
    const carteiras = await this.prisma.investmentPortfolio.findMany({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });

    return Promise.all(
      carteiras.map(async (carteira) => ({
        ...carteira,
        summary: await this.summary(userId, carteira.id),
      })),
    );
  }

  async findOne(userId: string, id: string) {
    const carteira = await this.getOwned(userId, id);
    return { ...carteira, summary: await this.summary(userId, id) };
  }

  /**
   * Os números da carteira, calculados pela **mesma** função que a Renda Fixa principal usa — a que
   * já bate cent a cent com o extrato do banco. Uma carteira separada não é um cálculo diferente,
   * é o mesmo cálculo sobre outro recorte.
   */
  private async summary(userId: string, portfolioId: string) {
    const aplicacoes = await this.fixedIncomes.findAll(userId, portfolioId);
    const ativas = aplicacoes.filter((f) => !f.redeemedAt);

    const invested = ativas.reduce((soma, f) => soma + Number(f.principalAmount), 0);
    const netValue = ativas.reduce((soma, f) => soma + f.calculation.netValue, 0);
    const netYield = ativas.reduce((soma, f) => soma + f.calculation.netYield, 0);

    return {
      count: ativas.length,
      redeemedCount: aplicacoes.length - ativas.length,
      invested,
      netValue,
      netYield,
      netYieldPercent: invested > 0 ? (netYield / invested) * 100 : 0,
    };
  }

  async create(userId: string, input: CreatePortfolioInput) {
    return this.prisma.investmentPortfolio.create({
      data: { userId, name: input.name.trim(), color: input.color ?? null, notes: input.notes ?? null },
    });
  }

  async update(userId: string, id: string, input: Partial<CreatePortfolioInput>) {
    await this.getOwned(userId, id);
    return this.prisma.investmentPortfolio.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
  }

  /**
   * Só apaga carteira vazia.
   *
   * A alternativa seria mover as aplicações pra principal — e isso é o oposto do que a carteira
   * existe pra fazer: o dinheiro da outra pessoa entraria no seu patrimônio por causa de um clique
   * de "excluir". Apagar uma por uma antes é chato e é a intenção.
   */
  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);
    const aplicacoes = await this.prisma.investmentFixedIncome.count({ where: { portfolioId: id, deletedAt: null } });
    if (aplicacoes > 0) {
      throw new BadRequestException(
        `Esta carteira ainda tem ${aplicacoes} aplicação(ões). Remova ou resgate antes de excluí-la.`,
      );
    }

    await this.prisma.investmentPortfolio.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id };
  }

  /** Valida que a carteira é do usuário. Usado também pelo cadastro de aplicação, pra um id chutado
   *  não conseguir escrever na carteira de outra conta. */
  async getOwned(userId: string, id: string) {
    const carteira = await this.prisma.investmentPortfolio.findUnique({ where: { id } });
    if (!carteira || carteira.deletedAt) throw new NotFoundException("Carteira não encontrada.");
    if (carteira.userId !== userId) throw new ForbiddenException();
    return carteira;
  }
}
