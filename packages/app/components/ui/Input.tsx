"use client";

import { InputHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <div className="group flex flex-col gap-2">
        {label && (
          <label htmlFor={fieldId} className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            id={fieldId}
            ref={ref}
            className={cn(
              "h-12 w-full rounded-lg border bg-card px-4 text-sm text-text-primary outline-none transition-all duration-200 placeholder:text-text-muted",
              error
                ? "border-error/50"
                : "border-border focus:border-accent/50 focus:shadow-[0_0_0_3px_rgb(var(--accent-solid)/0.18)]",
              className,
            )}
            {...props}
          />
        </div>
        {error && <span className="text-xs text-error">{error}</span>}
        {!error && hint && <span className="text-xs text-text-muted">{hint}</span>}
      </div>
    );
  },
);
Input.displayName = "Input";
