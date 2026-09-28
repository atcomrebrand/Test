import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { TrackingStatement } from "../types";
import { formatHoursLabel, formatPlacement, formatStatementDate, labelsFor, localeFor } from "../lib/statementI18n";

/**
 * O documento em si — o que vai pro papel.
 *
 * Separado da tela de configuração de propósito: tudo aqui é impressão, e a página que o envolve é
 * que tem os controles. É a única parte do app que não segue o tema: papel é branco, e um extrato
 * impresso em modo escuro sai com o fundo cinza gastando tinta e ilegível.
 *
 * Os números em dinheiro NÃO passam pelo `formatCurrency` do app: aquele formatador obedece ao modo
 * privacidade, e um extrato que sai do app com `•••••` no lugar do valor é um documento inútil.
 * Aqui o valor ou existe (via pessoal) ou não veio do servidor (via da empresa).
 */
export function StatementDocument({ data }: { data: TrackingStatement }) {
  const t = labelsFor(data.lang);
  const locale = localeFor(data.lang);
  const money = (v: number) =>
    v.toLocaleString(locale, { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
  const num = (v: number, casas = 1) => v.toLocaleString(locale, { maximumFractionDigits: casas });

  const pessoal = data.audience === "PERSONAL";
  const p = data.placement;

  return (
    <article className="statement mx-auto w-full max-w-[820px] bg-white p-8 text-[13px] leading-relaxed text-neutral-900">
      <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-900 pb-4">
        <div>
          <h1 className="text-2xl font-black leading-tight">{t.statement}</h1>
          <p className="mt-0.5 text-sm text-neutral-600">{pessoal ? t.personal : t.company}</p>
        </div>
        <div className="text-right text-xs text-neutral-600">
          <p>
            <span className="font-semibold text-neutral-900">{data.job.name}</span>
          </p>
          <p>
            {t.company_label}: {data.job.company}
          </p>
          {data.job.client && (
            <p>
              {t.client}: {data.job.client}
            </p>
          )}
          <p className="mt-1">
            {t.period}: {formatStatementDate(data.period.from, data.lang)} — {formatStatementDate(data.period.to, data.lang)}
          </p>
        </div>
      </header>

      <Secao titulo={t.summary}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Numero label={t.hours} valor={formatHoursLabel(data.totals.netSeconds, data.lang)} destaque />
          <Numero label={t.daysWorked} valor={String(data.totals.daysWorked)} />
          <Numero label={t.sessions} valor={String(data.totals.sessions)} />
          <Numero label={t.avgPerDay} valor={`${num(data.totals.averageHoursPerWorkedDay)} h`} />
          {/* O valor só existe quando o servidor mandou. Na via da empresa ele nem chega. */}
          {data.totals.totalValue !== null && <Numero label={t.totalValue} valor={money(data.totals.totalValue)} destaque />}
          {data.totals.averageHourlyRate !== null && <Numero label={t.hourlyRate} valor={money(data.totals.averageHourlyRate)} />}
        </div>
      </Secao>

      {data.byDay.length > 0 && (
        <Secao titulo={t.hoursPerDay}>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byDay} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "#525252" }}
                  tickFormatter={(d: string) => formatStatementDate(d, data.lang, { day: "2-digit", month: "2-digit" })}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: "#525252" }} tickLine={false} axisLine={false} width={34} />
                <Bar dataKey="hours" fill="#7C3AED" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Secao>
      )}

      {p && (
        <Secao titulo={t.performance}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Metrica label={t.placement} m={p.placement} t={t} formata={(v) => formatPlacement(v, data.lang, 1)} />
            <Metrica label={t.satisfaction} m={p.satisfaction} t={t} formata={(v) => `${num(v, 2)}%`} />
            <Metrica label={t.responseTime} m={p.responseMinutes} t={t} formata={(v) => `${num(v, 1)} ${t.minutes}`} />
          </div>

          {p.points.some((x) => x.placement !== null) && (
            <div className="mt-3 h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={p.points.filter((x) => x.placement !== null)} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#525252" }}
                    tickFormatter={(d: string) => formatStatementDate(d, data.lang, { day: "2-digit", month: "2-digit" })}
                    tickLine={false}
                    axisLine={false}
                  />
                  {/* Eixo invertido: em colocação menor é melhor, e sem inverter a subida no ranking
                      seria desenhada como uma queda. Mesma regra do gráfico de Estatísticas. */}
                  <YAxis
                    reversed
                    tick={{ fontSize: 10, fill: "#525252" }}
                    tickFormatter={(v: number) => formatPlacement(v, data.lang)}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Line type="monotone" dataKey="placement" stroke="#7C3AED" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Secao>
      )}

      <Secao titulo={t.detail}>
        {data.sessions.length === 0 ? (
          <p className="text-neutral-600">{t.noSessions}</p>
        ) : (
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="py-1.5 pr-2 font-semibold">{t.date}</th>
                <th className="py-1.5 pr-2 font-semibold">{t.in}</th>
                <th className="py-1.5 pr-2 font-semibold">{t.out}</th>
                <th className="py-1.5 pr-2 text-right font-semibold">{t.duration}</th>
                {pessoal && <th className="py-1.5 pr-2 text-right font-semibold">{t.value}</th>}
                {p && <th className="py-1.5 pr-2 text-right font-semibold">{t.placement}</th>}
                {p && <th className="py-1.5 pr-2 text-right font-semibold">{t.satisfaction}</th>}
                {p && <th className="py-1.5 pr-2 text-right font-semibold">{t.responseTime}</th>}
                <th className="py-1.5 font-semibold">{t.notes}</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((s, i) => (
                <tr key={i} className="break-inside-avoid border-b border-neutral-200 align-top">
                  <td className="py-1.5 pr-2 whitespace-nowrap">{formatStatementDate(s.date, data.lang, { day: "2-digit", month: "2-digit" })}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{hora(s.checkIn, locale)}</td>
                  <td className="py-1.5 pr-2 whitespace-nowrap">{s.checkOut ? hora(s.checkOut, locale) : "—"}</td>
                  <td className="py-1.5 pr-2 text-right whitespace-nowrap">{formatHoursLabel(s.netSeconds, data.lang)}</td>
                  {pessoal && <td className="py-1.5 pr-2 text-right whitespace-nowrap">{money(s.value)}</td>}
                  {p && <td className="py-1.5 pr-2 text-right">{s.placement === null ? "—" : formatPlacement(s.placement, data.lang)}</td>}
                  {p && <td className="py-1.5 pr-2 text-right">{s.satisfactionPercent === null ? "—" : `${num(s.satisfactionPercent, 2)}%`}</td>}
                  {p && <td className="py-1.5 pr-2 text-right">{s.responseMinutes === null ? "—" : `${s.responseMinutes} ${t.minutes}`}</td>}
                  {/* Em inglês vale a tradução; se ela não veio, o original — nunca um vazio, que
                      apagaria do documento algo que a pessoa escreveu. */}
                  <td className="py-1.5 text-neutral-700">{(data.lang === "EN" ? s.notesTranslated : null) ?? s.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Secao>

      <footer className="mt-6 border-t border-neutral-300 pt-3 text-[11px] text-neutral-500">
        <p>
          {t.generatedAt} {new Date(data.generatedAt).toLocaleString(locale)}
        </p>
        {!pessoal && <p>{t.noMoneyNote}</p>}
        {data.translation.requested && !data.translation.applied && <p>{t.translationOff}</p>}
      </footer>
    </article>
  );
}

function hora(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

/** `break-inside-avoid`: uma seção não pode ser cortada no meio pela quebra de página. */
function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">{titulo}</h2>
      {children}
    </section>
  );
}

function Numero({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className="rounded-lg border border-neutral-200 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={destaque ? "mt-0.5 text-lg font-bold" : "mt-0.5 font-semibold"}>{valor}</p>
    </div>
  );
}

function Metrica({
  label,
  m,
  t,
  formata,
}: {
  label: string;
  m: { best: number; average: number; days: number } | null;
  t: ReturnType<typeof labelsFor>;
  formata: (v: number) => string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</p>
      {m ? (
        <>
          <p className="mt-0.5">
            <span className="text-lg font-bold">{formata(m.best)}</span>{" "}
            <span className="text-[11px] text-neutral-500">{t.best}</span>
          </p>
          <p className="text-[11px] text-neutral-600">
            {t.average}: {formata(m.average)} · {m.days} {t.measuredDays}
          </p>
        </>
      ) : (
        <p className="mt-0.5 text-neutral-400">—</p>
      )}
    </div>
  );
}
