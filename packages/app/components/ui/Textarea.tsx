"use client";
import { cn } from "@/lib/cn";
import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
interface Props extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}
export const Textarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const generated = useId();
    const fieldId = id ?? generated;
    const description =
      [props["aria-describedby"], error || hint ? fieldId + "-help" : null]
        .filter(Boolean)
        .join(" ") || undefined;
    return (
      <div className="flex min-w-0 flex-col gap-2">
        {label && (
          <label
            htmlFor={fieldId}
            className="text-sm font-medium text-text-secondary"
          >
            {label}
          </label>
        )}
        <textarea
          {...props}
          ref={ref}
          id={fieldId}
          aria-invalid={!!error || props["aria-invalid"]}
          aria-describedby={description}
          className={cn("form-control", error && "border-error", className)}
        />
        {(error || hint) && (
          <p
            id={fieldId + "-help"}
            className={cn(
              "text-sm leading-relaxed",
              error ? "text-error" : "text-text-muted",
            )}
          >
            {error || hint}
          </p>
        )}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";
