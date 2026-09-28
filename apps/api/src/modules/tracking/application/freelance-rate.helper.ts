import { TrackingSessionRepository } from "../domain/tracking-session.repository";
import { computeSessionTime } from "../domain/session-time-calculator";
import { computeFreelanceHourlyRate } from "../domain/freelance-hourly-rate";
import { convertToBRL, TrackingCurrencyCode } from "../domain/currency-converter";

export interface FreelanceRateJob {
  id: string;
  type: string;
  totalAgreedValue: unknown;
  currency: TrackingCurrencyCode;
}

/**
 * A trabalho freelance's valor/hora is always totalAgreedValue ÷ total de horas cronometradas até
 * agora (nunca uma estimativa fixa como no trabalho fixo) — então precisa somar TODAS as sessões
 * concluídas desse trabalho, não só as do período sendo exibido. Reaproveitado por
 * TrackingJobsService, TrackingSessionsService, e todos os serviços de agregação (dashboard,
 * relatórios, estatísticas, calendário, exportação) pra nunca divergir de tela pra tela.
 */
export async function computeFreelanceRates(
  sessions: TrackingSessionRepository,
  jobs: FreelanceRateJob[],
  usdToBrlRate: number | null,
  extraSecondsByJob: Map<string, number> = new Map(),
): Promise<Map<string, number | null>> {
  const freelanceJobs = jobs.filter((j) => j.type === "FREELANCE" && j.totalAgreedValue !== null);
  const rates = new Map<string, number | null>();
  if (freelanceJobs.length === 0) return rates;

  const allSessions = await sessions.findCompletedByJobIds(freelanceJobs.map((j) => j.id));
  const secondsByJob = new Map<string, number>();
  for (const s of allSessions) {
    const time = computeSessionTime({ checkIn: s.checkIn, checkOut: s.checkOut, pauses: s.pauses });
    secondsByJob.set(s.jobId, (secondsByJob.get(s.jobId) ?? 0) + time.netSeconds);
  }

  for (const job of freelanceJobs) {
    const totalAgreedValueBRL = convertToBRL(Number(job.totalAgreedValue), job.currency, usdToBrlRate);
    const totalNetSeconds = (secondsByJob.get(job.id) ?? 0) + (extraSecondsByJob.get(job.id) ?? 0);
    const rate = totalAgreedValueBRL !== null ? computeFreelanceHourlyRate({ totalAgreedValueBRL, totalNetSeconds }) : null;
    rates.set(job.id, rate);
  }

  return rates;
}
