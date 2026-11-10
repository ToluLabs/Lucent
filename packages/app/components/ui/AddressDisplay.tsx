"use client";

import { cn } from "@/lib/cn";
import { shortAddress } from "@/lib/format";
import { Check, Copy, Lock } from "lucide-react";
import { useState } from "react";

interface AddressDisplayProps {
  address: string;
  chars?: number;
  className?: string;
  showCopy?: boolean;
  /** Recipient identity is itself encrypted — show a lock instead of the address. */
  encrypted?: boolean;
}

export function AddressDisplay({
  address,
  chars = 5,
  className,
  showCopy = true,
  encrypted = false,
}: AddressDisplayProps) {
  const [copyError, setCopyError] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      setCopyError(true);
      return;
    }
    setCopyError(false);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (encrypted) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-sm text-encrypted",
          className,
        )}
      >
        <Lock className="h-3 w-3" />
        Recipient hidden
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-sm text-text-secondary",
        className,
      )}
    >
      <span title={address}>{shortAddress(address, chars)}</span>
      {copyError && (
        <span role="status" className="text-xs text-warning">
          Copy unavailable
        </span>
      )}
      {showCopy && (
        <button
          type="button"
          aria-label={copied ? "Address copied" : "Copy full address"}
          onClick={copy}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:text-accent"
          title="Copy address"
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      )}
    </span>
  );
}
