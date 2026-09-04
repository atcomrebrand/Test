export type UpcomingEventSource = "parcelamento" | "casa" | "financiamento" | "investimentos";

export interface UpcomingEvent {
  source: UpcomingEventSource;
  label: string;
  date: Date;
  amount: number | null;
}

const DEFAULT_LIMIT = 8;

/** Junta eventos futuros de todos os módulos numa única lista ordenada por data — passado (`now`)
 *  fica de fora, já que "o que vem por aí" é sempre olhando pra frente. `now` é parâmetro (não
 *  `new Date()` interno) pra manter a função pura e testável com uma data fixa. */
export function mergeUpcomingEvents(events: UpcomingEvent[], now: Date, limit = DEFAULT_LIMIT): UpcomingEvent[] {
  return events
    .filter((e) => e.date.getTime() >= now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, limit);
}
