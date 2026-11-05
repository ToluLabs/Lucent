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
      onKeyDown={(e) => {
        // Arrow keys, Home and End move between segments, as in a native tablist.
        const i = options.findIndex((o) => o.value === value);
        let next = -1;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % options.length;
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + options.length) % options.length;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = options.length - 1;
        if (next === -1) return;
        e.preventDefault();
        onChange(options[next].value);
        (e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next])?.focus();
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          // Roving tabindex: only the active segment is a tab stop.
          tabIndex={value === o.value ? 0 : -1}
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
