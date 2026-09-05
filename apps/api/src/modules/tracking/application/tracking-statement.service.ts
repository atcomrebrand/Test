import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../../prisma/prisma.service";
import { computeSessionTime } from "../domain/session-time-calculator";
import { estimateJobHourlyRate } from "../domain/job-hourly-estimate";
import { computeFreelanceHourlyRate } from "../domain/freelance-hourly-rate";
import { convertToBRL } from "../domain/currency-converter";
import { StatementAudience, StatementLang, buildStatement } from "../domain/statement-summary";
import { TrackingFxService } from "./tracking-fx.service";
import { TrackingTranslationService } from "./tracking-translation.service";

/** Dia de calendário **no Brasil** de um instante — a mesma regra do mapa muscular e da liquidação
 *  da renda fixa: a API roda em UTC, e um turno que começou às 22h viraria o dia seguinte. */
const DIA_BR = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * Meia-noite de uma data de calendário brasileira, como instante.
 *
 * O Brasil não tem mais horário de verão desde 2019, então o deslocamento é fixo em −03:00 e o
 * `Date` sai exato — sem depender do fuso em que o servidor por acaso esteja rodando.
 */
function inicioDoDiaBR(iso: string, somarDias = 0): Date {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia + somarDias, 3, 0, 0));
}

@Injectable()
export class TrackingStatementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fx: TrackingFxService,
    private readonly translation: TrackingTranslationService,
  ) {}

  /**
   * O extrato de um trabalho num período, pronto pra virar PDF.
   *
   * **Um trabalho por extrato, e isso não é só recorte de tela**: a versão da empresa é feita pra
   * sair do app e chegar em outra pessoa, e um extrato "de tudo" entregaria os outros clientes
   * junto.
   */
  async generate(
    userId: string,
    params: { jobId: string; from: string; to: string; lang: StatementLang; audience: StatementAudience },
  ) {
    // O período chega como data de calendário ("2026-08-01"), e é assim que ele tem que ser lido.
    // `new Date("2026-08-01")` é meia-noite UTC — no Brasil ainda 31 de julho —, o que fazia o
    // extrato dizer "de 31/07" e, pior, deixava o primeiro dia do mês fora da consulta. O dia final
    // entra inteiro: o intervalo vai até a meia-noite do dia SEGUINTE.
    const from = inicioDoDiaBR(params.from);
    const to = inicioDoDiaBR(params.to, 1);

    const job = await this.prisma.trackingJob.findUnique({ where: { id: params.jobId } });
    if (!job || job.deletedAt) throw new NotFoundException("Trabalho não encontrado.");
    if (job.userId !== userId) throw new ForbiddenException();

    const raw = await this.prisma.trackingSession.findMany({
      where: { userId, jobId: job.id, status: "COMPLETED", checkIn: { gte: from, lt: to } },
      include: { pauses: true },
      orderBy: { checkIn: "asc" },
    });

    const usdToBrlRate = job.currency === "USD" ? await this.fx.getUsdToBrlRate() : null;
    const hourlyRate = await this.hourlyRate(job, usdToBrlRate);

    const sessions = raw.map((s) => {
      const time = computeSessionTime({ checkIn: s.checkIn, checkOut: s.checkOut, pauses: s.pauses });
      return {
        date: DIA_BR.format(s.checkIn),
        checkIn: s.checkIn.toISOString(),
        checkOut: s.checkOut ? s.checkOut.toISOString() : null,
        netSeconds: time.netSeconds,
        value: Math.round((time.netSeconds / 3600) * hourlyRate * 100) / 100,
        notes: s.notes,
        placement: s.placement,
        satisfactionPercent: s.satisfactionPercent === null ? null : Number(s.satisfactionPercent),
        responseMinutes: s.responseMinutes,
      };
    });

    const resumo = buildStatement(sessions, { audience: params.audience, tracksPlacement: job.tracksPlacement });

    // A tradução acontece DEPOIS do corte da empresa, sobre o que de fato vai sair — não adianta
    // gastar chamada de API traduzindo o que não entra no documento.
    let notesTranslated = false;
    if (params.lang === "EN") {
      const textos = resumo.sessions.map((s) => s.notes).filter((n): n is string => !!n && n.trim().length > 0);
      const mapa = await this.translation.translateMany(userId, textos, "EN");
      for (const s of resumo.sessions) {
        s.notesTranslated = s.notes ? (mapa.get(s.notes.trim()) ?? null) : null;
      }
      notesTranslated = mapa.size > 0;
    }

    return {
      job: {
        id: job.id,
        name: job.name,
        company: job.company,
        client: job.client,
        type: job.type,
        tracksPlacement: job.tracksPlacement,
      },
      // Ecoa o que foi pedido, sem reconverter: a data já é de calendário, e passá-la por um
      // `Date` de volta é justamente onde o fuso a deslocava.
      period: { from: params.from, to: params.to },
      lang: params.lang,
      audience: params.audience,
      /** Se alguma observação de fato foi traduzida, e se o tradutor sequer está configurado — a
       *  tela precisa dos dois pra avisar em vez de entregar um extrato meio em português calado. */
      translation: { requested: params.lang === "EN", available: this.translation.available, applied: notesTranslated },
      generatedAt: new Date().toISOString(),
      ...resumo,
    };
  }

  /** Mesma conta do resto do módulo: FIXO estima pelo mensal; FREELANCE divide o combinado pelas
   *  horas de TODA a vida do projeto, não só as do período. */
  private async hourlyRate(job: { id: string; type: string; monthlyValue: unknown; totalAgreedValue: unknown; currency: "BRL" | "USD"; expectedHoursPerDay: number; weekdays: number[] }, usdToBrlRate: number | null) {
    if (job.type === "FREELANCE") {
      const todas = await this.prisma.trackingSession.findMany({
        where: { jobId: job.id, status: "COMPLETED" },
        include: { pauses: true },
      });
      const segundos = todas.reduce(
        (acc, s) => acc + computeSessionTime({ checkIn: s.checkIn, checkOut: s.checkOut, pauses: s.pauses }).netSeconds,
        0,
      );
      const total = convertToBRL(Number(job.totalAgreedValue), job.currency, usdToBrlRate);
      // `null` quando ainda não há hora cronometrada: sem horas não existe valor-hora, e 0 é a
      // resposta honesta pro extrato (nenhuma sessão, nenhum valor).
      return total === null ? 0 : (computeFreelanceHourlyRate({ totalAgreedValueBRL: total, totalNetSeconds: segundos }) ?? 0);
    }

    const mensal = convertToBRL(Number(job.monthlyValue), job.currency, usdToBrlRate);
    return mensal === null
      ? 0
      : estimateJobHourlyRate({ monthlyValue: mensal, expectedHoursPerDay: job.expectedHoursPerDay, weekdays: job.weekdays });
  }
}
