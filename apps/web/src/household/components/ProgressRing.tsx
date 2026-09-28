interface Props {
  pct: number;
  label: string;
  color?: string;
}

/** Same SVG ring pattern as the Parcelas Dashboard's "Limite utilizado" widget, generalized for
 *  any percentage indicator (contas pagas, valor reservado, etc). */
export function ProgressRing({ pct, label, color = "#F59E0B" }: Props) {
  const clamped = Math.max(0, Math.min(100, pct));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col items-center py-2">
      <div className="relative flex h-32 w-32 items-center justify-center">
        <svg className="h-32 w-32 -rotate-90">
          <circle cx="64" cy="64" r={radius} strokeWidth="12" className="stroke-[rgb(var(--surface-2))]" fill="none" />
          <circle
            cx="64"
            cy="64"
            r={radius}
            strokeWidth="12"
            fill="none"
            strokeLinecap="round"
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - clamped / 100)}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <span className="absolute text-xl font-bold">{clamped.toFixed(0)}%</span>
      </div>
      <p className="mt-3 text-sm text-muted">{label}</p>
    </div>
  );
}
