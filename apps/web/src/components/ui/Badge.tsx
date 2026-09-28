import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

const tones: Record<Tone, string> = {
  neutral: "bg-[rgb(var(--surface-2))] text-muted",
  success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  danger: "bg-red-500/15 text-red-600 dark:text-red-400",
  accent: "bg-accent-500/15 text-accent-600 dark:text-accent-300",
};

export function Badge({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export const STATUS_TONE: Record<string, Tone> = {
  PENDING: "neutral",
  PAID: "success",
  LATE: "danger",
  CANCELLED: "warning",
};

export const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  PAID: "Pago",
  LATE: "Atrasado",
  CANCELLED: "Cancelado",
};
