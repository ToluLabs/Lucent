"use client";

import { NumericKeypad } from "./NumericKeypad";
import { cn } from "@/lib/cn";

interface AmountFieldProps {
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  maxValue?: string;
  onMax?: () => void;
  maxDecimals?: number;
  error?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Amount entry that fits the device: a big on-screen keypad on phones, a plain
 * large text field with a Max shortcut on desktop. Both edit the same string.
 */
export function AmountField({
  value,
  onChange,
  unit = "USDC",
  maxValue,
  onMax,
  maxDecimals = 7,
  error,
  disabled,
  className,
}: AmountFieldProps) {
  function typed(raw: string) {
    let v = raw.replace(/[^0-9.]/g, "");
    const firstDot = v.indexOf(".");
    if (firstDot !== -1) v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
    if (v.startsWith(".")) v = "0" + v;
    const [whole, frac] = v.split(".");
    if (frac !== undefined && frac.length > maxDecimals) v = `${whole}.${frac.slice(0, maxDecimals)}`;
    if (whole && whole.length > 1 && whole.startsWith("0") && frac === undefined) v = whole.replace(/^0+/, "") || "0";
    if (maxValue !== undefined) {
      const n = parseFloat(v);
      const m = parseFloat(maxValue);
      if (!isNaN(n) && !isNaN(m) && n > m) return;
    }
    onChange(v);
  }

  return (
    <div className={className}>
      <div className="md:hidden">
        <NumericKeypad
          value={value}
          onChange={onChange}
          unit={unit}
          maxValue={maxValue}
          onMax={onMax}
          maxDecimals={maxDecimals}
          error={error}
          disabled={disabled}
        />
      </div>

      <div className="hidden md:block">
        <label htmlFor="amount-field" className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-text-muted">Amount</span>
          {maxValue !== undefined && (
            <span className="text-xs text-text-muted">
              Available <span className="font-mono text-text-secondary">{maxValue} {unit}</span>
            </span>
          )}
        </label>
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl border bg-card px-5 transition-shadow focus-within:shadow-[0_0_0_3px_rgb(var(--accent-solid)/0.18)]",
            error ? "border-error/60" : "border-border focus-within:border-accent-solid/60",
            disabled && "opacity-50",
          )}
        >
          <input
            id="amount-field"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            disabled={disabled}
            value={value}
            onChange={(e) => typed(e.target.value)}
            className="h-20 min-w-0 flex-1 bg-transparent font-serif text-5xl tabular-nums tracking-tight outline-none placeholder:text-text-muted/50"
          />
          <span className="font-mono text-sm text-text-muted">{unit}</span>
          {onMax && (
            <button
              type="button"
              onClick={onMax}
              className="rounded-md border border-border bg-panel px-2.5 py-1 text-xs font-semibold text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
            >
              Max
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-error">{error}</p>}
      </div>
    </div>
  );
}
