import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";

export interface SearchResult {
  type: "SESSION" | "INCOME";
  id: string;
  label: string;
  sublabel: string;
  amount: number;
  date: Date;
}

const RESULT_LIMIT = 30;

/** Free-text search across trabalho (fixo ou freelance)/cliente/empresa/categoria/observações,
 *  plus an exact-amount match when the query parses as a number — spanning sessions (fixo e
 *  freelance, via seu trabalho) e outras entradas em uma lista de resultados unificada. */
@Injectable()
export class TrackingSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, query: string): Promise<SearchResult[]> {
    const q = query.trim();
    if (!q) return [];

    const amount = Number(q.replace(",", "."));
    const hasAmount = !Number.isNaN(amount) && q.length > 0;

    const [sessions, incomes] = await Promise.all([
      this.prisma.trackingSession.findMany({
        where: {
          userId,
          status: "COMPLETED",
          OR: [
            { notes: { contains: q, mode: "insensitive" } },
            {
              job: {
                is: {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { company: { contains: q, mode: "insensitive" } },
                    { client: { contains: q, mode: "insensitive" } },
                    ...(hasAmount ? [{ monthlyValue: amount as any }, { totalAgreedValue: amount as any }] : []),
                  ],
                },
              },
            },
          ],
        },
        include: { job: true },
        orderBy: { checkIn: "desc" },
        take: RESULT_LIMIT,
      }),
      this.prisma.trackingIncome.findMany({
        where: {
          userId,
          deletedAt: null,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { notes: { contains: q, mode: "insensitive" } },
            ...(hasAmount ? [{ amount: amount as any }] : []),
            ...(this.matchesCategory(q) ? [{ category: this.matchesCategory(q) as any }] : []),
          ],
        },
        orderBy: { date: "desc" },
        take: RESULT_LIMIT,
      }),
    ]);

    const results: SearchResult[] = [
      ...sessions.map((s) => ({
        type: "SESSION" as const,
        id: s.id,
        label: `${s.job.name} — ${s.job.company}`,
        sublabel: s.job.client ?? s.notes ?? (s.job.type === "FREELANCE" ? "Projeto extra" : "Sessão de trabalho"),
        amount: 0,
        date: s.checkIn,
      })),
      ...incomes.map((i) => ({
        type: "INCOME" as const,
        id: i.id,
        label: i.name,
        sublabel: i.category,
        amount: Number(i.amount),
        date: i.date,
      })),
    ];

    return results.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, RESULT_LIMIT);
  }

  private matchesCategory(q: string): string | null {
    const categories = ["DIVIDENDO", "VENDA", "BONIFICACAO", "CASHBACK", "REEMBOLSO", "PRESENTE", "OUTRO"];
    const upper = q.toUpperCase();
    return categories.find((c) => c.startsWith(upper)) ?? null;
  }
}
