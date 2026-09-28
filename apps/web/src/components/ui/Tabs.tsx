import { cn } from "@/lib/cn";

interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export function Tabs({ value, onChange, options, className }: TabsProps) {
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-xl surface-2 p-1", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            value === opt.value ? "surface shadow-soft" : "text-muted hover:text-[rgb(var(--text))]",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
