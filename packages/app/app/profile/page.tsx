"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, LogOut, Activity, BookOpen, Info, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Pill } from "@/components/ui/Pill";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { useWallet } from "@/lib/wallet-context";
import { useRequireWallet } from "@/lib/use-require-wallet";
import { ConnectPrompt } from "@/components/ui/ConnectPrompt";
import { DEPLOYMENT } from "@/lib/deployment";

export default function ProfilePage() {
  const wallet = useRequireWallet();
  const { view, disconnect, resync } = useWallet();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  async function copy() {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  function handleDisconnect() {
    disconnect();
    router.push("/");
  }

  async function handleResync() {
    setResyncing(true);
    try {
      await resync();
    } finally {
      setResyncing(false);
    }
  }

  if (!wallet) {
    return (
      <AppShell>
        <PageHeader title="Profile" showBack={false} />
        <ConnectPrompt message="Connect your wallet to view your profile." />
      </AppShell>
    );
  }

  const synced = view?.matchesChain === true;
  const mismatch = view?.matchesChain === false;

  return (
    <AppShell>
      <PageHeader title="Profile" subtitle="Your wallet and connection." showBack={false} />

      <div className="flex flex-col gap-5 px-4 pb-8 md:mx-auto md:max-w-2xl md:px-8">
        <section className="glass-card overflow-hidden">
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
            <LucentLogoMark size={52} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-mono text-sm">{wallet.address.slice(0, 8)}…{wallet.address.slice(-6)}</span>
                <button onClick={copy} aria-label="Copy address" className="text-text-muted transition-colors hover:text-accent">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Pill tone="amber">Stellar Testnet</Pill>
                <Pill tone={synced ? "green" : mismatch ? "red" : "neutral"}>
                  {synced ? "State matches chain" : mismatch ? "Mismatch" : view ? "Syncing…" : "-"}
                </Pill>
              </div>
            </div>
          </div>
          {mismatch && (
            <div className="flex flex-col gap-3 border-t border-border bg-card/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-sm text-text-secondary">
                Local state disagrees with the chain. A resync clears the local cache and replays event history.
              </p>
              <Button size="sm" variant="secondary" isLoading={resyncing} onClick={handleResync}>
                <RefreshCw className="h-3.5 w-3.5" />
                Resync from chain
              </Button>
            </div>
          )}
        </section>

        <SectionLabel>Protocol</SectionLabel>

        <dl className="glass-card overflow-hidden">
          {[
            { label: "Encryption", value: "Pedersen commitments (Grumpkin)" },
            { label: "Proofs", value: "UltraHonk, verified on-chain" },
            { label: "Privacy", value: "Amount-hidden on-chain" },
            { label: "Network", value: "Stellar Testnet" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-4 border-t border-border px-5 py-3.5 first:border-t-0">
              <dt className="text-sm text-text-muted">{label}</dt>
              <dd className="text-right font-mono text-xs text-text-secondary">{value}</dd>
            </div>
          ))}
        </dl>

        <SectionLabel>Links</SectionLabel>

        <div className="flex flex-col gap-2 px-1">
          <a
            href={`https://stellar.expert/explorer/testnet/account/${wallet.address}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-accent"
          >
            <Activity className="h-4 w-4" />
            View on Stellar Expert
          </a>
          <a href="/docs" className="flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-accent">
            <BookOpen className="h-4 w-4" />
            Documentation
          </a>
          <a href="/about" className="flex items-center gap-2 text-sm text-text-secondary transition-colors hover:text-accent">
            <Info className="h-4 w-4" />
            About Lucent
          </a>
        </div>

        <div className="pt-2">
          <Button variant="danger" fullWidth size="lg" onClick={handleDisconnect}>
            <LogOut className="h-4 w-4" />
            Disconnect
          </Button>
        </div>

        <footer className="text-center font-mono text-[11px] text-text-muted">
          token {DEPLOYMENT.contracts.token.slice(0, 4)}…{DEPLOYMENT.contracts.token.slice(-4)}
        </footer>
      </div>
    </AppShell>
  );
}
