"use client";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { AddressDisplay } from "@/components/ui/AddressDisplay";
import { Button } from "@/components/ui/Button";
import { ConnectPrompt } from "@/components/ui/ConnectPrompt";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { GlassCard } from "@/components/ui/GlassCard";
import { Modal } from "@/components/ui/Modal";
import { DEPLOYMENT } from "@/lib/deployment";
import { useWallet } from "@/lib/wallet-context";
import Link from "next/link";
import { useState } from "react";
export default function ProfilePage() {
  const {
    wallet,
    view,
    disconnect,
    refresh,
    resync,
    error,
    setError,
    lastSync,
  } = useWallet();
  const [confirm, setConfirm] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!wallet)
    return (
      <AppShell>
        <PageHeader title="Account settings" />
        <ConnectPrompt message="Connect to inspect account health and manage your wallet session." />
      </AppShell>
    );
  return (
    <AppShell>
      <PageHeader title="Account settings" />
      <div className="workspace-page space-y-6">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        <div className="workspace-grid">
          <div className="space-y-6">
            <GlassCard padding="lg">
              <h2 className="text-lg font-semibold">Connected wallet</h2>
              <div className="my-5">
                <AddressDisplay address={wallet.address} chars={8} />
              </div>
              <p className="text-sm leading-6 text-text-secondary">
                Varial authorizes transactions. Disconnecting ends this app
                session without deleting confidential keys or payment state from
                this browser.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={disconnect}>
                  Disconnect wallet
                </Button>
                <a
                  href={`https://stellar.expert/explorer/testnet/account/${wallet.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-3 text-sm text-accent"
                >
                  View wallet on explorer ↗
                </a>
              </div>
            </GlassCard>
            <GlassCard padding="lg">
              <h2 className="text-lg font-semibold">Account health</h2>
              <p className="my-4 text-sm">
                {!view
                  ? "Account status unavailable"
                  : !view.registered
                    ? "Registration required"
                    : view.matchesChain
                      ? "Local confidential state matches the chain"
                      : "Local confidential state does not match the chain"}
              </p>
              <p className="text-xs text-text-muted">
                {lastSync
                  ? `Last successful check: ${lastSync.toLocaleString()}`
                  : "No successful account check yet"}
              </p>
              <Button
                className="mt-5"
                variant="secondary"
                isLoading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await refresh();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Refresh account
              </Button>
              <details className="mt-6 border-t border-border pt-4">
                <summary className="text-sm font-medium">
                  Advanced recovery
                </summary>
                <p className="my-4 text-sm leading-7 text-text-secondary">
                  Verified recovery rebuilds balances in memory from available
                  events. It replaces cached state only when both balances match
                  the chain. Older events may be missing; a failed recovery
                  preserves your existing state. Try an ordinary refresh first.
                </p>
                <Button variant="danger" onClick={() => setConfirm(true)}>
                  Review full replay
                </Button>
              </details>
            </GlassCard>
          </div>
          <aside className="space-y-6">
            <GlassCard padding="lg">
              <h2 className="font-semibold">Privacy and storage</h2>
              <p className="my-4 text-sm leading-7 text-text-secondary">
                Browser storage contains confidential state and retained proof
                openings. Clearing it is not a guaranteed reset or recovery
                method. Deposits, withdrawals, addresses and metadata remain
                public. Public demo auditor keys reveal covered amounts.
              </p>
            </GlassCard>
            <GlassCard padding="lg">
              <h2 className="font-semibold">Technical details</h2>
              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="text-text-muted">Network</dt>
                  <dd className="mt-1">Stellar Testnet</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Commitments</dt>
                  <dd className="mt-1">Pedersen · Grumpkin</dd>
                </div>
                <div>
                  <dt className="text-text-muted">Proof system</dt>
                  <dd className="mt-1">UltraHonk · browser proving</dd>
                </div>
              </dl>
              <details className="mt-5">
                <summary className="text-sm text-text-secondary">
                  Token contract
                </summary>
                <a
                  href={`https://stellar.expert/explorer/testnet/contract/${DEPLOYMENT.contracts.token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 block break-all font-mono text-xs leading-6 text-accent"
                >
                  {DEPLOYMENT.contracts.token}
                </a>
              </details>
              <Link
                href="/docs"
                className="mt-5 inline-block text-sm text-accent"
              >
                Read documentation →
              </Link>
            </GlassCard>
          </aside>
        </div>
      </div>
      <Modal
        open={confirm}
        busy={busy}
        onClose={() => setConfirm(false)}
        title="Verify recovery from available history"
      >
        <p className="text-sm leading-7 text-text-secondary">
          Recovery checks reconstructed balances against the chain before
          saving. If history is incomplete or a request fails, existing cached
          state is preserved. This operation cannot restore missing history.
        </p>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          I understand that missing history may prevent recovery.
        </label>
        <Button
          variant="danger"
          disabled={!ack}
          isLoading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await resync();
              setConfirm(false);
            } finally {
              setBusy(false);
            }
          }}
        >
          Run full replay
        </Button>
      </Modal>
    </AppShell>
  );
}
