import { Car, Bike, Home, Landmark, type LucideIcon } from "lucide-react";
import { FinancingKind } from "@/types";

export const FINANCING_KIND_META: Record<FinancingKind, { label: string; icon: LucideIcon; color: string }> = {
  CAR: { label: "Carro", icon: Car, color: "#3B82F6" },
  MOTORCYCLE: { label: "Moto", icon: Bike, color: "#F97316" },
  HOUSE: { label: "Casa", icon: Home, color: "#22C55E" },
  OTHER: { label: "Outro", icon: Landmark, color: "#6B7280" },
};

export const FINANCING_KIND_OPTIONS = (Object.keys(FINANCING_KIND_META) as FinancingKind[]).map((value) => ({
  value,
  label: FINANCING_KIND_META[value].label,
}));
