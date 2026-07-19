import { motion } from "framer-motion";
import { Wifi } from "lucide-react";
import { CreditCard } from "@/types";
import { cn } from "@/lib/cn";

interface Props {
  card: CreditCard;
  onClick?: () => void;
  className?: string;
}

function shade(hex: string, percent: number) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function CreditCardVisual({ card, onClick, className }: Props) {
  const gradient = `linear-gradient(135deg, ${shade(card.color, 15)} 0%, ${card.color} 45%, ${shade(card.color, -25)} 100%)`;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        "relative flex h-48 w-full flex-col justify-between overflow-hidden rounded-3xl p-5 text-left text-white shadow-elevated",
        !card.active && "grayscale",
        className,
      )}
      style={{ backgroundImage: gradient }}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-black/10" />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-white/70">{card.bank}</p>
          <p className="mt-0.5 text-lg font-bold leading-tight">{card.name}</p>
        </div>
        <Wifi className="h-5 w-5 rotate-90 text-white/80" />
      </div>

      <div className="relative">
        <p className="font-mono text-lg tracking-[0.2em] text-white/90">•••• •••• •••• {card.lastDigits}</p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase text-white/60">Fecha dia</p>
            <p className="text-sm font-semibold">{card.closingDay}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-white/60">Vence dia</p>
            <p className="text-sm font-semibold">{card.dueDay}</p>
          </div>
          <p className="text-sm font-black italic tracking-tight">{card.brand}</p>
        </div>
      </div>

      {!card.active && (
        <span className="absolute right-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase">
          Inativo
        </span>
      )}
    </motion.button>
  );
}
