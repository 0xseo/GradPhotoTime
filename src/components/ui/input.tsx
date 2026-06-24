import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function Input({ className, id, label, ...props }: InputProps) {
  const inputId = id ?? props.name;

  return (
    <label className="block space-y-2" htmlFor={inputId}>
      {label ? (
        <span className="text-sm font-medium text-foreground">{label}</span>
      ) : null}
      <input
        id={inputId}
        className={cn(
          "h-12 w-full rounded-md border border-border bg-background px-3 text-base text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary",
          className,
        )}
        {...props}
      />
    </label>
  );
}
