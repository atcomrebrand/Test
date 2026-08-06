import { Info } from "lucide-react";

/**
 * The one sentence that has to travel with every tax figure in this module.
 *
 * The number on a nota is the "valor aproximado dos tributos" the Lei 12.741/2012 requires stores
 * to print — computed from IBPT reference tables by product NCM, not from what the store actually
 * collected, and with federal, state and municipal lumped together. Shown bare it reads as "imposto
 * que eu paguei", which it is not, so it is never shown bare.
 */
export function TaxDisclaimer({ className }: { className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 text-xs text-muted ${className ?? ""}`}>
      <Info className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>
        Valor <strong className="font-medium">aproximado</strong> dos tributos, como manda a Lei 12.741/2012. Sai de tabelas
        do IBPT por tipo de produto — não é o imposto exato que o mercado recolheu — e já vem com federal, estadual e
        municipal somados.
      </span>
    </p>
  );
}
