import { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
}

export const Label = ({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("mb-1.5 block text-sm font-medium text-[rgb(var(--text))]", className)} {...props} />
);

/**
 * O `id` que liga o rótulo ao campo.
 *
 * Sem `id`, o `htmlFor` saía vazio e o rótulo virava texto solto: leitor de tela anuncia um campo
 * sem nome e o toque no rótulo não põe o foco no campo. Isso valia pra todo formulário do app, já
 * que ninguém passa `id` à mão — e era o que obrigava a carimbar um `id` por campo pra cada tela
 * nova. O gerado só entra quando o autor não deu um, então quem já passa o seu não muda nada.
 */
function useFieldId(id?: string): string {
  const gerado = useId();
  return id ?? gerado;
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const fieldId = useFieldId(id);
    return (
    <div className="w-full">
      {label && <Label htmlFor={fieldId}>{label}</Label>}
      <input
        ref={ref}
        id={fieldId}
        className={cn(
          "h-10 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-base outline-none transition-colors placeholder:text-muted focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 sm:text-sm",
          error && "border-red-400 focus:border-red-500 focus:ring-red-500/20",
          className,
        )}
        {...props}
      />
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
    );
  },
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const fieldId = useFieldId(id);
    return (
    <div className="w-full">
      {label && <Label htmlFor={fieldId}>{label}</Label>}
      <textarea
        ref={ref}
        id={fieldId}
        className={cn(
          "w-full rounded-xl border border-[rgb(var(--border))] surface px-3 py-2 text-base outline-none transition-colors placeholder:text-muted focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 sm:text-sm",
          error && "border-red-400",
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
    );
  },
);
Textarea.displayName = "Textarea";

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement>, FieldProps {
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, id, ...props }, ref) => {
    const fieldId = useFieldId(id);
    return (
    <div className="w-full">
      {label && <Label htmlFor={fieldId}>{label}</Label>}
      <select
        ref={ref as any}
        id={fieldId}
        className={cn(
          "h-10 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-base outline-none transition-colors focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 sm:text-sm",
          error && "border-red-400",
          className,
        )}
        {...(props as any)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
    );
  },
);
Select.displayName = "Select";
