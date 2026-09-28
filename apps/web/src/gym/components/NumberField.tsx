import { useState } from "react";
import { cn } from "@/lib/cn";

interface Props {
  value: number;
  onChange: (value: number) => void;
  /** Aplicado ao SAIR do campo, nunca a cada tecla. */
  min?: number;
  max?: number;
  decimal?: boolean;
  className?: string;
  "aria-label": string;
}

/**
 * Campo numérico que se deixa apagar.
 *
 * O problema que ele resolve: com o valor vindo direto do estado e um `Math.max(1, …)` a cada
 * tecla, apagar o conteúdo devolvia "1" na hora — o campo se recusava a ficar vazio, e digitar um
 * número novo virava "selecionar o que está lá e substituir". Na academia, de pé e com pressa, isso
 * é atrito puro.
 *
 * A saída é um **rascunho local enquanto o campo está sendo editado**: o que aparece é exatamente o
 * que foi digitado, inclusive vazio. O número só é normalizado (mínimo, máximo, vírgula) quando o
 * dedo sai do campo. E tocar no campo **seleciona tudo**, então digitar já substitui — que é o que
 * se quer em 90% dos casos, já que a carga costuma mudar inteira, não por dígito.
 */
export function NumberField({ value, onChange, min, max, decimal, className, "aria-label": ariaLabel }: Props) {
  const [draft, setDraft] = useState<string | null>(null);

  const exibido = draft ?? formatar(value, decimal);

  return (
    <input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      value={exibido}
      aria-label={ariaLabel}
      onFocus={(e) => {
        setDraft(formatar(value, decimal));
        e.target.select();
      }}
      onChange={(e) => {
        const bruto = decimal ? e.target.value.replace(/[^\d,.]/g, "") : e.target.value.replace(/\D/g, "");
        setDraft(bruto);
        // Campo vazio não vira 0: o valor anterior fica de pé até a pessoa digitar algo ou sair.
        if (bruto === "") return;
        const n = Number(bruto.replace(",", "."));
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => {
        const bruto = draft ?? "";
        const n = bruto === "" ? value : Number(bruto.replace(",", "."));
        const normalizado = clamp(Number.isFinite(n) ? n : value, min, max);
        onChange(normalizado);
        setDraft(null);
      }}
      className={cn("bg-transparent tabular-nums outline-none", className)}
    />
  );
}

function clamp(v: number, min?: number, max?: number): number {
  let r = v;
  if (min !== undefined) r = Math.max(min, r);
  if (max !== undefined) r = Math.min(max, r);
  return r;
}

function formatar(v: number, decimal?: boolean): string {
  if (!decimal) return String(Math.round(v));
  return Number.isInteger(v) ? String(v) : String(v).replace(".", ",");
}
