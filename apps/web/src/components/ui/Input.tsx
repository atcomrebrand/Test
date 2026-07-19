import { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
}

export const Label = ({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn("mb-1.5 block text-sm font-medium text-[rgb(var(--text))]", className)} {...props} />
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldProps>(
  ({ className, label, error, hint, id, ...props }, ref) => (
    <div className="w-full">
      {label && <Label htmlFor={id}>{label}</Label>}
      <input
        ref={ref}
        id={id}
        className={cn(
          "h-10 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-sm outline-none transition-colors placeholder:text-muted focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20",
          error && "border-red-400 focus:border-red-500 focus:ring-red-500/20",
          className,
        )}
        {...props}
      />
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  ({ className, label, error, id, ...props }, ref) => (
    <div className="w-full">
      {label && <Label htmlFor={id}>{label}</Label>}
      <textarea
        ref={ref}
        id={id}
        className={cn(
          "w-full rounded-xl border border-[rgb(var(--border))] surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20",
          error && "border-red-400",
          className,
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  ),
);
Textarea.displayName = "Textarea";

interface SelectProps extends InputHTMLAttributes<HTMLSelectElement>, FieldProps {
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, id, ...props }, ref) => (
    <div className="w-full">
      {label && <Label htmlFor={id}>{label}</Label>}
      <select
        ref={ref as any}
        id={id}
        className={cn(
          "h-10 w-full rounded-xl border border-[rgb(var(--border))] surface px-3 text-sm outline-none transition-colors focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20",
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
  ),
);
Select.displayName = "Select";
