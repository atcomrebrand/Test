import { mergeUpcomingEvents, UpcomingEvent } from "./upcoming-events-merger";

const now = new Date("2026-07-30T12:00:00Z");

function event(overrides: Partial<UpcomingEvent> & { date: Date }): UpcomingEvent {
  return { source: "parcelamento", label: "evento", amount: null, ...overrides };
}

describe("mergeUpcomingEvents", () => {
  it("sorts events from different sources by date", () => {
    const events = [
      event({ source: "casa", label: "Aluguel", date: new Date("2026-08-05") }),
      event({ source: "parcelamento", label: "Fatura Nubank", date: new Date("2026-08-01") }),
      event({ source: "financiamento", label: "Parcela do carro", date: new Date("2026-08-10") }),
    ];

    const result = mergeUpcomingEvents(events, now);
    expect(result.map((e) => e.label)).toEqual(["Fatura Nubank", "Aluguel", "Parcela do carro"]);
  });

  it("excludes events strictly in the past", () => {
    const events = [event({ label: "Já venceu", date: new Date("2026-07-01") }), event({ label: "Ainda vem", date: new Date("2026-08-01") })];

    const result = mergeUpcomingEvents(events, now);
    expect(result.map((e) => e.label)).toEqual(["Ainda vem"]);
  });

  it("includes an event happening exactly now", () => {
    const events = [event({ label: "Agora", date: now })];
    const result = mergeUpcomingEvents(events, now);
    expect(result).toHaveLength(1);
  });

  it("caps the result at the given limit", () => {
    const events = Array.from({ length: 20 }, (_, i) => event({ label: `Evento ${i}`, date: new Date(now.getTime() + (i + 1) * 86_400_000) }));
    const result = mergeUpcomingEvents(events, now, 5);
    expect(result).toHaveLength(5);
    expect(result[0].label).toBe("Evento 0");
  });
});
