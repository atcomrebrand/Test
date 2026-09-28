import { useEffect, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";

interface CategoryEntry {
  name: string;
  color: string;
  total: number;
  /** Raw category/class key (e.g. "STOCK") — lets `details` below be matched to the right entry.
   *  Optional: without it, selecting a slice still highlights + shows the % and value, just no
   *  per-item breakdown. */
  key?: string;
}

interface Props {
  data: CategoryEntry[];
  /** Optional per-item breakdown (e.g. individual assets) shown under the selected category when
   *  its `class` matches the entry's `key`. */
  details?: { label: string; class: string; value: number }[];
}

const GREY = "#9CA3AF";

export function CategoryChart({ data, details }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocumentClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSelected(null);
      }
    }
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

  if (data.length === 0) return null;

  const total = data.reduce((sum, e) => sum + e.total, 0);
  const percent = (value: number) => (total > 0 ? (value / total) * 100 : 0);

  function toggle(idx: number) {
    setSelected(idx);
  }

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="w-full max-w-[240px] shrink-0 sm:w-1/2 sm:max-w-none">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} dataKey="total" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {data.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={selected === null || selected === idx ? entry.color : GREY}
                  fillOpacity={selected === null || selected === idx ? 1 : 0.4}
                  stroke="none"
                  className="cursor-pointer transition-opacity"
                  onClick={() => toggle(idx)}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{ borderRadius: 12, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))", fontSize: 13 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full flex-1 space-y-1">
        {data.slice(0, 6).map((entry, idx) => {
          const isSelected = selected === idx;
          const itemDetails = isSelected && entry.key ? details?.filter((d) => d.class === entry.key) : undefined;
          return (
            <div key={entry.name}>
              <button
                type="button"
                onClick={() => toggle(idx)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  isSelected ? "surface-2" : "hover:surface-2",
                )}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: selected === null || isSelected ? entry.color : GREY, opacity: selected === null || isSelected ? 1 : 0.5 }}
                />
                <span className={cn("flex-1 truncate", selected !== null && !isSelected && "text-muted")}>{entry.name}</span>
                <span className="shrink-0 text-xs text-muted">{percent(entry.total).toFixed(1)}%</span>
                <span className="shrink-0 font-medium">{formatCurrency(entry.total)}</span>
              </button>
              {isSelected && (
                <div className="ml-4 mt-1 rounded-lg surface-2 px-3 py-2 text-xs text-muted">
                  <p>
                    {entry.name} representa <span className="font-semibold text-[rgb(var(--text))]">{percent(entry.total).toFixed(1)}%</span> do
                    total ({formatCurrency(entry.total)}).
                  </p>
                  {itemDetails && itemDetails.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-[rgb(var(--border))] pt-2">
                      {itemDetails
                        .sort((a, b) => b.value - a.value)
                        .map((d, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <span>{d.label}</span>
                            <span className="font-medium text-[rgb(var(--text))]">{formatCurrency(d.value)}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
