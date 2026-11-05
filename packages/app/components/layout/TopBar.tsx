"use client";

import Link from "next/link";
import { useWallet } from "@/lib/wallet-context";
import { shortAddress } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { cn } from "@/lib/cn";

/** Sticky strip above every app screen: brand (mobile), sync state, theme, wallet. */
export function TopBar() {
  const { wallet, view, connecting, connect } = useWallet();

  const synced = view?.matchesChain === true;
  const mismatch = view?.matchesChain === false;

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-void/80 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-4 md:h-16 md:justify-end md:px-8">
        <Link href="/" className="flex items-center gap-2 md:hidden" aria-label="Lucent home">
          <LucentLogoMark size={26} />
          <span className="font-display text-base font-semibold tracking-tight">Lucent</span>
        </Link>

        <div className="ml-auto flex items-center gap-2.5">
          {wallet && (
            <div className="hidden items-center gap-2 rounded-xl border border-border bg-panel px-3 py-1.5 sm:flex">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  synced ? "bg-success" : mismatch ? "bg-error" : "animate-pulse bg-warning",
                )}
              />
              <span className="font-mono text-xs text-text-secondary">{shortAddress(wallet.address, 5)}</span>
            </div>
          )}
          <ThemeToggle />
          {!wallet && (
            <Button size="sm" isLoading={connecting} onClick={connect}>
              Connect
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
