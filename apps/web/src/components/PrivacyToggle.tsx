import { Eye, EyeOff } from "lucide-react";
import { usePrivacyStore } from "@/store/privacy";
import { cn } from "@/lib/cn";

/**
 * O olho que esconde os valores. Mora em todos os cabeçalhos (Home, Topbar e os seis módulos)
 * porque a hora em que ele é preciso é quando alguém já está olhando a tela — ter que navegar até
 * as Configurações pra ligar não serve pra nada.
 */
export function PrivacyToggle({ className }: { className?: string }) {
  const hidden = usePrivacyStore((s) => s.hidden);
  const toggle = usePrivacyStore((s) => s.toggle);

  return (
    <button
      onClick={toggle}
      className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors hover:surface-2", className)}
      aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
      aria-pressed={hidden}
      title={hidden ? "Mostrar valores" : "Ocultar valores"}
    >
      {hidden ? <EyeOff className="h-5 w-5 text-accent-500" /> : <Eye className="h-5 w-5" />}
    </button>
  );
}
