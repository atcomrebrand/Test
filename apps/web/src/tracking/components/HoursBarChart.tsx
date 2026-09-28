import { formatHours } from "@/lib/format";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Props {
  data: { date: string; hours: number }[];
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}


/** New chart type for this repo (only Pie/Area existed before) — matches the same visual
 *  conventions: CSS-var-based tooltip, no axis lines, muted tick color. */
export function HoursBarChart({ data }: Props) {
  const chartData = data.map((d) => ({ label: formatDayLabel(d.date), hours: d.hours }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }} axisLine={false} tickLine={false} width={32} />
        <Tooltip
          formatter={(value: number) => formatHours(value)}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid rgb(var(--border))",
            background: "rgb(var(--surface))",
            fontSize: 13,
          }}
        />
        <Bar dataKey="hours" fill="#7C3AED" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
