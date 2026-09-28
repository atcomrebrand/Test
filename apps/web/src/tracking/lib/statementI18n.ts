import { StatementLang } from "../types";

/**
 * Os rótulos do extrato nos dois idiomas.
 *
 * Um dicionário local, e não uma biblioteca de i18n: o app inteiro é em português e só este
 * documento é bilíngue. Trazer um framework de tradução pra uma tela seria peso e cerimônia pra
 * doze frases — e a decisão de idioma aqui não é a do app, é a de quem vai LER o papel.
 */
const DICIONARIO = {
  PT: {
    statement: "Extrato de horas",
    personal: "Via pessoal",
    company: "Via da empresa",
    period: "Período",
    company_label: "Empresa",
    client: "Cliente",
    job: "Trabalho",
    generatedAt: "Emitido em",
    summary: "Resumo",
    hours: "Horas trabalhadas",
    daysWorked: "Dias trabalhados",
    sessions: "Registros",
    avgPerDay: "Média por dia",
    totalValue: "Total recebido",
    hourlyRate: "Valor por hora",
    performance: "Desempenho",
    placement: "Colocação",
    satisfaction: "Satisfação dos clientes",
    responseTime: "Tempo de resposta",
    best: "Melhor",
    average: "Média",
    measuredDays: "dias com registro",
    hoursPerDay: "Horas por dia",
    detail: "Detalhamento",
    date: "Data",
    in: "Entrada",
    out: "Saída",
    duration: "Duração",
    value: "Valor",
    notes: "Observações",
    noSessions: "Nenhum registro no período.",
    noMoneyNote: "Esta via não inclui valores.",
    translationOff: "As observações não puderam ser traduzidas e aparecem no idioma original.",
    minutes: "min",
    day: "dia",
    days: "dias",
  },
  EN: {
    statement: "Timesheet statement",
    personal: "Personal copy",
    company: "Company copy",
    period: "Period",
    company_label: "Company",
    client: "Client",
    job: "Engagement",
    generatedAt: "Issued on",
    summary: "Summary",
    hours: "Hours worked",
    daysWorked: "Days worked",
    sessions: "Entries",
    avgPerDay: "Average per day",
    totalValue: "Total earned",
    hourlyRate: "Hourly rate",
    performance: "Performance",
    placement: "Ranking",
    satisfaction: "Customer satisfaction",
    responseTime: "Response time",
    best: "Best",
    average: "Average",
    measuredDays: "days with data",
    hoursPerDay: "Hours per day",
    detail: "Detail",
    date: "Date",
    in: "In",
    out: "Out",
    duration: "Duration",
    value: "Amount",
    notes: "Notes",
    noSessions: "No entries in this period.",
    noMoneyNote: "This copy does not include monetary figures.",
    translationOff: "Notes could not be translated and are shown in their original language.",
    minutes: "min",
    day: "day",
    days: "days",
  },
} as const;

/** As chaves saem do dicionário em português, que é o de referência: assim faltar uma tradução no
 *  inglês vira erro de compilação em vez de um rótulo em branco no papel. */
export type StatementLabels = Record<keyof (typeof DICIONARIO)["PT"], string>;

export function labelsFor(lang: StatementLang): StatementLabels {
  return DICIONARIO[lang];
}

/** O locale acompanha o idioma do documento: um extrato em inglês com "1.234,50" e "10/08/2026"
 *  não passaria por um documento em inglês. */
export function localeFor(lang: StatementLang): string {
  return lang === "EN" ? "en-US" : "pt-BR";
}

/**
 * A posição no ranking, no idioma do documento.
 *
 * "1º" é português: num extrato em inglês ele denuncia a origem do documento tanto quanto um rótulo
 * não traduzido. Em inglês vira "#1", que é a notação de ranking e funciona igual pra qualquer
 * número — diferente de "1st/2nd/3rd", que precisaria de regra de ordinal e quebraria em "3.8th".
 */
export function formatPlacement(value: number, lang: StatementLang, casas = 0): string {
  const n = value.toLocaleString(localeFor(lang), { maximumFractionDigits: casas });
  return lang === "EN" ? `#${n}` : `${n}º`;
}

export function formatHoursLabel(seconds: number, lang: StatementLang): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return lang === "EN" ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h${String(m).padStart(2, "0")}`;
}

/**
 * Data por extenso no idioma do documento.
 *
 * Lida como calendário (meio-dia UTC) e não como instante: "2026-08-01" cru viraria 31 de julho em
 * qualquer fuso negativo, e um extrato que erra o primeiro dia do mês é um extrato errado.
 */
export function formatStatementDate(iso: string, lang: StatementLang, opts?: Intl.DateTimeFormatOptions): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, 12)).toLocaleDateString(localeFor(lang), {
    timeZone: "UTC",
    ...(opts ?? { day: "2-digit", month: "short", year: "numeric" }),
  });
}
