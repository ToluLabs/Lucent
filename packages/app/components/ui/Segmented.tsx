"use client";

import { cn } from "@/lib/cn";

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  ariaLabel?: string;
}

/** Quiet two-to-four way switch. The active segment lifts onto a white/panel surface. */
export function Segmented<T extends string>({ value, onChange, options, className, ariaLabel }: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("inline-flex w-full rounded-lg border border-border bg-card p-1", className)}
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all duration-150",
            value === o.value
              ? "bg-panel text-text-primary shadow-card ring-1 ring-border"
              : "text-text-muted hover:text-text-secondary",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
