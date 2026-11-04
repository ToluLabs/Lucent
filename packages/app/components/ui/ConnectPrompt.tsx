"use client";

import { Wallet } from "lucide-react";
import { Button } from "./Button";
import { useWallet } from "@/lib/wallet-context";

/**
 * Inline stand-in for wallet-gated screens. Pages that need a connected
 * wallet render this instead of their real content when disconnected.
 * No redirect, so the nav stays put and Auditor/Prove stay one tap away.
 */
export function ConnectPrompt({ message }: { message: string }) {
  const { connecting, connect } = useWallet();

  return (
    <div className="px-4 pb-10 md:mx-auto md:max-w-2xl md:px-8">
      <div className="glass-card flex flex-col items-start gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-text-secondary">
            <Wallet className="h-5 w-5" strokeWidth={1.6} />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Connect your wallet</h2>
            <p className="mt-1 max-w-sm text-sm leading-relaxed text-text-secondary">{message}</p>
          </div>
        </div>
        <Button isLoading={connecting} onClick={connect} className="shrink-0">
          Connect wallet
        </Button>
      </div>
    </div>
  );
}
