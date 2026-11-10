"use client";
import { transactionError } from "@/lib/action-result";
import { X } from "lucide-react";
interface Props {
  error: string | null;
  onDismiss?: () => void;
  className?: string;
  size?: "sm" | "md";
}
export function ErrorBanner({ error, onDismiss, className = "" }: Props) {
  if (!error) return null;
  const info = transactionError(error);
  return (
    <div
      role="alert"
      className={`rounded-lg border ${info.uncertain ? "border-warning/40 bg-warning/5" : "border-error/30 bg-error/5"} p-4 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{info.title}</p>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {info.advice}
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss error"
            className="flex h-9 w-9 shrink-0 items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {info.hash && (
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${info.hash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block text-sm text-accent"
        >
          Check transaction on Stellar Expert ↗
        </a>
      )}
      <details className="mt-3 text-xs text-text-secondary">
        <summary className="py-2">Technical details</summary>
        <pre className="whitespace-pre-wrap break-all leading-6">{error}</pre>
      </details>
    </div>
  );
}
