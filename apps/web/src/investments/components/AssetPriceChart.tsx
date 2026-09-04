import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatDate } from "@/lib/format";
import { HistoricalPricePoint } from "../types";

interface Props {
  history: HistoricalPricePoint[];
  positive: boolean;
}

/** How many days the series spans, start to end — decides how much detail the axis labels need.
 *  A 3-month range and a 30-year "Máximo" range (now that history can reach back to 1995) need
 *  very different granularity, and there's no reliable way to know which without just measuring
 *  the actual data — the selected range button isn't passed down here, and "Personalizado" can be
 *  any width anyway. */
function daySpan(history: HistoricalPricePoint[]): number {
  if (history.length < 2) return 0;
  const first = new Date(history[0].date).getTime();
  const last = new Date(history[history.length - 1].date).getTime();
  return (last - first) / (1000 * 60 * 60 * 24);
}

/** Below ~4 months: day + month (unchanged from before). Up to ~2 years: month + 2-digit year, so
 *  consecutive Januaries don't look identical. Beyond that (decades, once "Máximo" reaches back to
 *  1995): year only — a "DD Mon" label repeated across 30 years is actively misleading, since e.g.
 *  every "03 jan" from 1995 to 2026 would render identically with no way to tell them apart. */
function formatAxisTick(dateStr: string, spanDays: number): string {
  if (spanDays > 730) return formatDate(dateStr, { year: "numeric" });
  if (spanDays > 120) return formatDate(dateStr, { month: "short", year: "2-digit" });
  return formatDate(dateStr, { day: "2-digit", month: "short" });
}

export function AssetPriceChart({ history, positive }: Props) {
  const color = positive ? "#10B981" : "#EF4444";
  const chartData = history.map((p) => ({ date: p.date, close: p.close }));
  const spanDays = daySpan(history);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--border))" />
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => formatAxisTick(value, spanDays)}
          tick={{ fontSize: 11, fill: "rgb(var(--text-muted))" }}
          axisLine={false}
          tickLine={false}
          minTickGap={30}
        />
        <YAxis
          domain={["auto", "auto"]}
          tick={{ fontSize: 12, fill: "rgb(var(--text-muted))" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatCurrency(v)}
          width={70}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          // Always the full date with year, regardless of axis granularity — the axis itself may
          // collapse to "2005" alone for a wide range, but the tooltip on hover should never be
          // ambiguous about which day it's actually showing.
          labelFormatter={(value: string) => formatDate(value, { day: "2-digit", month: "short", year: "numeric" })}
          contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 13 }}
        />
        <Area type="monotone" dataKey="close" stroke={color} strokeWidth={2.5} fill="url(#colorPrice)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
