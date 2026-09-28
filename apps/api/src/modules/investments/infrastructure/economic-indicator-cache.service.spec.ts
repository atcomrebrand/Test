import { EconomicIndicatorCacheService } from "./economic-indicator-cache.service";
import { DailyRatePoint, EconomicIndicatorProvider } from "../domain/market-data.provider";
import { PrismaService } from "../../../prisma/prisma.service";

const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Banco de mentira que guarda as linhas em memória e responde os mesmos filtros que o serviço usa. */
function fakePrisma(seed: { date: Date; value: number }[] = []) {
  const rows = [...seed];
  return {
    rows,
    economicDailyRate: {
      findMany: jest.fn(async ({ where }: any) =>
        rows
          .filter((r) => r.date >= where.date.gte && r.date <= where.date.lte)
          .sort((a, b) => a.date.getTime() - b.date.getTime())
          .map((r) => ({ ...r, value: r.value })),
      ),
      findFirst: jest.fn(async ({ orderBy }: any) => {
        if (rows.length === 0) return null;
        const sorted = [...rows].sort((a, b) => a.date.getTime() - b.date.getTime());
        return orderBy.date === "asc" ? sorted[0] : sorted[sorted.length - 1];
      }),
      createMany: jest.fn(async ({ data }: any) => {
        for (const d of data) if (!rows.some((r) => r.date.getTime() === d.date.getTime())) rows.push({ date: d.date, value: d.value });
        return { count: data.length };
      }),
    },
  } as unknown as PrismaService & { rows: { date: Date; value: number }[] };
}

function fakeProvider(series: DailyRatePoint[] | null) {
  return {
    fetchAnnualCdiRate: jest.fn(async () => 14.9),
    fetchAnnualIpcaRate: jest.fn(async () => 4.5),
    fetchDailyCdiSeries: jest.fn(async (from: Date, to: Date) =>
      series === null ? null : series.filter((p) => p.date >= from && p.date <= to),
    ),
  } as unknown as EconomicIndicatorProvider & { fetchDailyCdiSeries: jest.Mock };
}

// Uma semana útil: 05/01 a 09/01 de 2026 (seg a sex).
const SEMANA: DailyRatePoint[] = [
  { date: dia("2026-01-05"), value: 0.055 },
  { date: dia("2026-01-06"), value: 0.055 },
  { date: dia("2026-01-07"), value: 0.056 },
  { date: dia("2026-01-08"), value: 0.056 },
  { date: dia("2026-01-09"), value: 0.057 },
];

describe("EconomicIndicatorCacheService.getDailyCdiWindow", () => {
  it("busca a série toda quando o banco está vazio e guarda pra próxima", async () => {
    const prisma = fakePrisma();
    const provider = fakeProvider(SEMANA);
    const service = new EconomicIndicatorCacheService(provider, prisma);

    const janela = await service.getDailyCdiWindow(dia("2026-01-05"), dia("2026-01-10"));

    expect(janela?.rates).toEqual([0.055, 0.055, 0.056, 0.056, 0.057]);
    expect(janela?.lastDate).toEqual(dia("2026-01-09"));
    expect(prisma.rows).toHaveLength(5);
  });

  it("não vai à rede de novo quando o período já está inteiro no banco", async () => {
    const prisma = fakePrisma(SEMANA.map((p) => ({ date: p.date, value: p.value })));
    const provider = fakeProvider(SEMANA);
    const service = new EconomicIndicatorCacheService(provider, prisma);

    await service.getDailyCdiWindow(dia("2026-01-06"), dia("2026-01-09"));

    expect(provider.fetchDailyCdiSeries).not.toHaveBeenCalled();
  });

  /** O dia do "as of" não entra: o rendimento é creditado de um dia pro outro. */
  it("exclui o próprio dia da consulta e inclui a véspera", async () => {
    const prisma = fakePrisma(SEMANA.map((p) => ({ date: p.date, value: p.value })));
    const service = new EconomicIndicatorCacheService(fakeProvider(SEMANA), prisma);

    const janela = await service.getDailyCdiWindow(dia("2026-01-05"), dia("2026-01-08"));

    expect(janela?.rates).toEqual([0.055, 0.055, 0.056]); // 05, 06 e 07 — não o 08
  });

  it("aplicar e consultar no mesmo dia não rende nada", async () => {
    const service = new EconomicIndicatorCacheService(fakeProvider(SEMANA), fakePrisma());
    const janela = await service.getDailyCdiWindow(dia("2026-01-05"), dia("2026-01-05"));
    expect(janela).toEqual({ rates: [], lastDate: null });
  });

  it("busca só o pedaço anterior quando a aplicação é mais velha que o que está guardado", async () => {
    const guardado = SEMANA.slice(2).map((p) => ({ date: p.date, value: p.value })); // a partir de 07/01
    const prisma = fakePrisma(guardado);
    const provider = fakeProvider(SEMANA);
    const service = new EconomicIndicatorCacheService(provider, prisma);

    const janela = await service.getDailyCdiWindow(dia("2026-01-05"), dia("2026-01-10"));

    expect(provider.fetchDailyCdiSeries).toHaveBeenCalledTimes(1);
    const [from, to] = provider.fetchDailyCdiSeries.mock.calls[0];
    expect(from).toEqual(dia("2026-01-05"));
    expect(to).toEqual(dia("2026-01-06")); // só até a véspera do que já tinha
    expect(janela?.rates).toHaveLength(5);
  });

  it("devolve null quando não tem nada guardado e a fonte não responde", async () => {
    const service = new EconomicIndicatorCacheService(fakeProvider(null), fakePrisma());
    expect(await service.getDailyCdiWindow(dia("2026-01-05"), dia("2026-01-10"))).toBeNull();
  });

  it("com a fonte fora do ar mas histórico no banco, ainda entrega o que dá", async () => {
    const prisma = fakePrisma(SEMANA.map((p) => ({ date: p.date, value: p.value })));
    const service = new EconomicIndicatorCacheService(fakeProvider(null), prisma);

    const janela = await service.getDailyCdiWindow(dia("2026-01-05"), dia("2026-01-10"));

    expect(janela?.rates).toHaveLength(5);
  });

  it("normaliza horário: data com hora não muda quais dias entram", async () => {
    const prisma = fakePrisma(SEMANA.map((p) => ({ date: p.date, value: p.value })));
    const service = new EconomicIndicatorCacheService(fakeProvider(SEMANA), prisma);

    const comHora = await service.getDailyCdiWindow(new Date("2026-01-05T18:42:11Z"), new Date("2026-01-08T03:10:00Z"));

    expect(comHora?.rates).toEqual([0.055, 0.055, 0.056]);
  });

  it("não bate na ponta a cada leitura — a série sai uma vez por dia útil", async () => {
    const prisma = fakePrisma(SEMANA.map((p) => ({ date: p.date, value: p.value })));
    const provider = fakeProvider(SEMANA);
    const service = new EconomicIndicatorCacheService(provider, prisma);

    // Pede um período que passa do que está guardado, três vezes seguidas.
    await service.getDailyCdiWindow(dia("2026-01-05"), dia("2026-01-20"));
    await service.getDailyCdiWindow(dia("2026-01-05"), dia("2026-01-20"));
    await service.getDailyCdiWindow(dia("2026-01-05"), dia("2026-01-20"));

    expect(provider.fetchDailyCdiSeries).toHaveBeenCalledTimes(1);
  });
});
