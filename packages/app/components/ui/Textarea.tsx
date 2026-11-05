"use client";

import { TextareaHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "@/lib/cn";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const autoId = useId();
    const fieldId = id ?? autoId;
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label htmlFor={fieldId} className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">{label}</label>
        )}
        <textarea
          id={fieldId}
          ref={ref}
          className={cn(
            "w-full rounded-lg border bg-card px-4 py-3 text-sm text-text-primary outline-none transition-all duration-200 placeholder:text-text-muted",
            error
              ? "border-error/50"
              : "border-border focus:border-accent/50 focus:shadow-[0_0_0_3px_rgb(var(--accent-solid)/0.18)]",
            className,
          )}
          {...props}
        />
        {error && <span className="text-xs text-error">{error}</span>}
        {!error && hint && <span className="text-xs text-text-muted">{hint}</span>}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";
