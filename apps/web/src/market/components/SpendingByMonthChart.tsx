import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, MONTH_SHORT } from "@/lib/format";
import { MonthlySpending } from "../types";

/** "2026-08" → "Ago/26". */
function monthTick(month: string): string {
  const [year, mes] = month.split("-");
  return `${MONTH_SHORT[Number(mes) - 1]}/${year.slice(2)}`;
}

/** Spend and tax side by side rather than stacked: the tax is already *inside* the spend, so
 *  stacking them would draw a bar taller than what was actually paid.
 *
 *  O gráfico continua mostrando o histórico inteiro mesmo quando a tela está num mês só: ele é
 *  justamente a comparação entre meses, e filtrar pra um deixaria uma barra sozinha. O mês
 *  escolhido é destacado (`selected`) — as outras barras ficam esmaecidas, e é isso que diz "você
 *  está aqui" sem tirar o resto de vista. Clicar numa barra escolhe aquele mês.
 */
export function SpendingByMonthChart({
  months,
  selected,
  onSelect,
}: {
  months: MonthlySpending[];
  selected?: string | null;
  onSelect?: (month: string) => void;
}) {
  const data = months.map((m) => ({ month: m.month, label: monthTick(m.month), Gasto: m.totalSpent, Tributos: m.totalTax }));
  // Sem mês escolhido ("Tudo") nenhuma barra é esmaecida: destacar todas é o mesmo que não destacar
  // nenhuma, e meia opacidade em tudo só deixaria o gráfico apagado.
  const opacityOf = (month: string) => (!selected || selected === month ? 1 : 0.3);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }}
          axisLine={false}
          tickLine={false}
          // One decimal on the k, because rounding to whole thousands labels 1200 as "1k" and 1600
          // as "2k" — two ticks reading the same, and neither being the value it sits at.
          tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : String(v))}
          width={48}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 13 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Gasto" fill="#0EA5E9" radius={[8, 8, 0, 0]} onClick={(d: { month: string }) => onSelect?.(d.month)} cursor={onSelect ? "pointer" : undefined}>
          {data.map((d) => (
            <Cell key={d.month} fillOpacity={opacityOf(d.month)} />
          ))}
        </Bar>
        <Bar dataKey="Tributos" fill="#F59E0B" radius={[8, 8, 0, 0]} onClick={(d: { month: string }) => onSelect?.(d.month)} cursor={onSelect ? "pointer" : undefined}>
          {data.map((d) => (
            <Cell key={d.month} fillOpacity={opacityOf(d.month)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
