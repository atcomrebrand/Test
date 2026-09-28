interface Props {
  label?: string;
  className?: string;
}

/** A small "this money is actively earning, not sitting idle" indicator — a pulsing green dot
 *  (the classic "live" badge look) next to staking-enabled crypto and any active renda fixa
 *  application, both of which accrue yield continuously even though nothing visibly "happens". */
export function YieldingIndicator({ label, className }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`} title="Rendendo">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {label && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{label}</span>}
    </span>
  );
}
