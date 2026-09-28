import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface StatTileProps {
  label: string;
  value: string;
  icon?: ReactNode;
  sublabel?: string;
  tone?: "default" | "danger" | "success";
  delay?: number;
}

export function StatTile({ label, value, icon, sublabel, tone = "default", delay = 0 }: StatTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="surface flex flex-col gap-2 rounded-2xl border border-[rgb(var(--border))] p-5 shadow-soft"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        {icon && (
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              tone === "danger" && "bg-red-500/10 text-red-500",
              tone === "success" && "bg-emerald-500/10 text-emerald-500",
              tone === "default" && "bg-accent-500/10 text-accent-500",
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <span className="text-2xl font-bold tracking-tight">{value}</span>
      {sublabel && <span className="text-xs text-muted">{sublabel}</span>}
    </motion.div>
  );
}
