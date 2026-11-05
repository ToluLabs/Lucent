"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowDownUp,
  Send,
  Briefcase,
  Lock,
  ArrowDownLeft,
  ArrowUpRight,
  Layers,
  UserCheck,
  Activity,
} from "lucide-react";
import {
  ChainClient,
  IndexerClient,
  hybridFetchEvents,
  type ConfidentialEvent,
  type TransferEvent,
  type EscrowInfo,
} from "@lucent/sdk";
import type { ConfidentialWallet } from "@/lib/wallet";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { EncryptedBadge } from "@/components/ui/EncryptedBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { TxStatus, type TxStep } from "@/components/ui/TxStatus";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { AddressDisplay } from "@/components/ui/AddressDisplay";
import { Modal } from "@/components/ui/Modal";
import { ConnectPrompt } from "@/components/ui/ConnectPrompt";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { DiscloseFlow } from "./disclose-flow";
import { Onboarding } from "./onboarding";
import { useWallet } from "@/lib/wallet-context";
import { shortAddress, timeAgo } from "@/lib/format";
import { displayAmount, formatMoney } from "@/lib/amount";
import { DEPLOYMENT } from "@/lib/deployment";
import { cn } from "@/lib/cn";
import { errMsg } from "@/lib/err";
import { demoEvents, demoEnabled } from "@/lib/demo";

const QUICK_ACTIONS = [
  { href: "/shield", icon: ArrowDownUp, label: "Shield", hint: "Deposit or withdraw" },
  { href: "/send", icon: Send, label: "Send", hint: "Pay an account" },
  { href: "/payroll", icon: Briefcase, label: "Payroll", hint: "Run salaries" },
  { href: "/escrow", icon: Lock, label: "Escrow", hint: "Hold funds" },
];

/**
 * The RPC's `getEvents` returns each event's ledger close time at no extra
 * cost, so most events get a real "2m ago". Indexer-sourced events don't
 * currently carry this (the Worker's raw rows don't surface it), so those
 * fall back to the bare ledger number.
 */
function relativeTime(ev: ConfidentialEvent): string {
  if (ev.closedAt) return timeAgo(new Date(ev.closedAt).getTime());
  return `Ledger ${ev.ledger}`;
}

type IconType = ComponentType<{ className?: string; strokeWidth?: number }>;

/**
 * Cross-referenced context that lets a plain `confidential_transfer`/`merge`
 * be relabeled with what it actually was. The token contract has no notion of
 * "payroll" or "escrow", a salary is just a transfer between two regular
 * (G...) addresses, indistinguishable on-chain from a deliberate personal
 * Send between the same two people. Only escrow gets relabeled, because it's
 * the one case with a hard signal: the counterparty being a contract (C...)
 * address, every escrow instance IS its own confidential account, not a
 * guess about intent. `escrowByAddress` resolves it to depositor/recipient.
 *
 * Payroll deliberately does NOT get the same treatment. An earlier version
 * relabeled any transfer to/from a known employer/employee of yours as
 * "Salary," but that's wrong the moment that employer and employee also send
 * each other money directly for any other reason, which is exactly a
 * personal transfer, and mislabeling it erodes trust in the whole feed.
 * There's no on-chain marker that distinguishes a transfer submitted via
 * PayrollVault's execute_run from one submitted directly by a wallet with the
 * same from/to, the PayrollVault contract's own EmployeePaid/RunExecuted
 * events would be the correct signal (matched by transaction hash), but that
 * means fetching a second contract's event stream, not implemented here.
 * A merge is likewise NOT relabeled "Claimed payroll" for the same reason:
 * claim() is literally token.merge() under another name.
 */
interface EventContext {
  me: string;
  escrowByAddress: Map<string, EscrowInfo>;
}

function describeEvent(ev: ConfidentialEvent, ctx: EventContext): { icon: IconType; iconColor: string; label: string } {
  const { me, escrowByAddress } = ctx;
  switch (ev.type) {
    case "transfer": {
      const counterparty = ev.to === me ? ev.from : ev.to;
      const received = ev.to === me;

      const escrow = escrowByAddress.get(counterparty);
      if (escrow) {
        if (received && escrow.depositor === me) {
          return { icon: Lock, iconColor: "text-warning", label: "Escrow refunded to you" };
        }
        if (received && escrow.recipient === me) {
          return { icon: Lock, iconColor: "text-success", label: "Escrow released to you" };
        }
        if (!received) {
          return { icon: Lock, iconColor: "text-warning", label: "Escrow funded" };
        }
      }

      return received
        ? { icon: ArrowDownLeft, iconColor: "text-success", label: `Received from ${shortAddress(ev.from, 4)}` }
        : { icon: ArrowUpRight, iconColor: "text-text-secondary", label: `Sent to ${shortAddress(ev.to, 4)}` };
    }
    case "deposit":
      return { icon: ArrowDownUp, iconColor: "text-accent", label: "Deposited" };
    case "withdraw":
      return { icon: ArrowDownUp, iconColor: "text-accent", label: "Withdrew" };
    case "merge":
      return { icon: Layers, iconColor: "text-encrypted", label: "Merged into spendable" };
    case "register":
      return { icon: UserCheck, iconColor: "text-encrypted", label: "Registered account" };
  }
}

function ActivityRow({
  ev,
  wallet,
  ctx,
  decryptedAmount,
}: {
  ev: ConfidentialEvent;
  wallet: ConfidentialWallet;
  ctx: EventContext;
  /** `undefined` = still decrypting, `null` = couldn't be attributed to this wallet. */
  decryptedAmount?: bigint | null;
}) {
  const me = ctx.me;
  const { icon: Icon, iconColor, label } = describeEvent(ev, ctx);
  const [proveOpen, setProveOpen] = useState(false);

  const direction: "received" | "sent" | null =
    ev.type !== "transfer" ? null : ev.to === me ? "received" : "sent";
  const canDisclose =
    direction === "received" || (direction === "sent" && wallet.canDiscloseSent(ev as TransferEvent));

  const explorerUrl = `https://stellar.expert/explorer/testnet/tx/${ev.txHash}`;
  function openExplorer() {
    window.open(explorerUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <li className="border-t border-border first:border-t-0">
      <div
        role="button"
        tabIndex={0}
        onClick={openExplorer}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openExplorer()}
        className="grid cursor-pointer grid-cols-[2rem_1fr_auto_auto] items-center gap-x-3 px-4 py-3.5 md:gap-x-4 md:px-5 transition-colors hover:bg-fg/[0.03] md:grid-cols-[2rem_minmax(0,1.6fr)_7rem_9rem_3.5rem]"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card">
          <Icon className={cn("h-4 w-4", iconColor)} strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-text-primary">{label}</div>
          <div className="text-xs text-text-muted md:hidden">{relativeTime(ev)}</div>
        </div>
        <div className="hidden text-sm text-text-muted md:block">{relativeTime(ev)}</div>
        <div className="flex items-center justify-end">
          {ev.type === "transfer" &&
            (decryptedAmount === undefined ? (
              <Skeleton className="h-4 w-16" />
            ) : decryptedAmount === null ? (
              <EncryptedBadge />
            ) : (
              <span className={cn("font-mono text-sm font-medium tabular-nums", direction === "received" ? "text-success" : "text-text-primary")}>
                {direction === "received" ? "+" : "-"}
                {formatMoney(decryptedAmount)}
              </span>
            ))}
          {ev.type === "deposit" && (
            <span className="font-mono text-sm font-medium tabular-nums text-success">+{formatMoney(ev.amount)}</span>
          )}
          {ev.type === "withdraw" && (
            <span className="font-mono text-sm font-medium tabular-nums text-text-primary">-{formatMoney(ev.amount)}</span>
          )}
        </div>
        <div className="flex min-w-[2.75rem] justify-end">
          {direction && canDisclose && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setProveOpen((v) => !v);
              }}
              className="rounded-md px-2 py-1 text-xs font-medium text-text-muted transition-colors hover:bg-fg/[0.06] hover:text-accent"
            >
              {proveOpen ? "Close" : "Prove"}
            </button>
          )}
        </div>
      </div>
      {direction && (
        <Modal open={proveOpen} onClose={() => setProveOpen(false)} title="Prove This Transfer">
          <DiscloseFlow ev={ev as TransferEvent} direction={direction} wallet={wallet} />
        </Modal>
      )}
    </li>
  );
}

export function HomeClient() {
  const router = useRouter();
  const { wallet, view: liveView, cachedView, connecting, connect, refresh, lastSync, error, setError } = useWallet();
  // Until the chain sync finishes, paint last-known balances from the local cache.
  const view = liveView ?? cachedView;
  const provisional = !liveView && !!cachedView;

  const [syncing, setSyncing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeSteps, setMergeSteps] = useState<TxStep[]>([]);
  const [registering, setRegistering] = useState(false);
  const [registerSteps, setRegisterSteps] = useState<TxStep[]>([]);

  const [activity, setActivity] = useState<ConfidentialEvent[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [decryptedAmounts, setDecryptedAmounts] = useState<Map<string, bigint | null>>(new Map());
  const [escrowByAddress, setEscrowByAddress] = useState<Map<string, EscrowInfo>>(new Map());

  useEffect(() => {
    if (!wallet) return;
    if (demoEnabled()) {
      setActivity(demoEvents());
      setActivityLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setActivityLoading(true);
      try {
        const client = new ChainClient({
          rpcUrl: DEPLOYMENT.rpcUrl,
          networkPassphrase: DEPLOYMENT.networkPassphrase,
          contracts: DEPLOYMENT.contracts,
        });
        const indexer = DEPLOYMENT.indexerUrl
          ? new IndexerClient({ baseUrl: DEPLOYMENT.indexerUrl })
          : undefined;
        const { events } = await hybridFetchEvents(client, indexer, {
          fromLedger: DEPLOYMENT.deployedAtLedger,
        });
        const mine = events.filter((ev) => {
          switch (ev.type) {
            case "transfer":
              return ev.from === wallet.address || ev.to === wallet.address;
            case "deposit":
              return ev.to === wallet.address;
            case "withdraw":
              return ev.from === wallet.address;
            case "merge":
            case "register":
              return ev.account === wallet.address;
          }
        });
        if (!cancelled) setActivity(mine.slice(-20).reverse());
      } catch {
        // Read-only history fetch, fall back to the empty state rather than
        // surfacing an error for something the user didn't initiate.
        if (!cancelled) setActivity([]);
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  // Decrypt each transfer's amount for display, this is the account's own
  // data, so there's no reason to keep it hidden from the owner the way it's
  // hidden from everyone else. Received transfers decrypt with just the
  // owner's own key; sent transfers need one extra RPC lookup per event (the
  // recipient's viewing key), so this runs as its own effect rather than
  // blocking the activity list from rendering.
  useEffect(() => {
    if (!wallet || !activity) return;
    const transfers = activity.filter((ev): ev is TransferEvent => ev.type === "transfer");
    if (transfers.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        transfers.map(async (ev): Promise<[string, bigint | null]> => {
          try {
            return [ev.cursor, await wallet.decryptOwnTransferAmount(ev)];
          } catch {
            return [ev.cursor, null];
          }
        }),
      );
      if (!cancelled) setDecryptedAmounts(new Map(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet, activity]);

  // Resolve escrow instance details (depositor/recipient/state) for every
  // contract-address counterparty appearing in the activity feed, so those
  // transfers can be relabeled "Escrow funded/released/refunded" instead of
  // a bare address. This is a hard signal (every escrow instance IS its own
  // confidential account), not a heuristic like the payroll match above.
  useEffect(() => {
    if (!wallet || !activity || !DEPLOYMENT.contracts.escrowFactory) return;
    const contractCounterparties = new Set<string>();
    for (const ev of activity) {
      if (ev.type !== "transfer") continue;
      const counterparty = ev.to === wallet.address ? ev.from : ev.to;
      if (!counterparty.startsWith("G")) contractCounterparties.add(counterparty);
    }
    if (contractCounterparties.size === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        [...contractCounterparties].map(async (addr): Promise<[string, EscrowInfo] | null> => {
          try {
            return [addr, await wallet.escrowInfo(addr)];
          } catch {
            return null;
          }
        }),
      );
      if (!cancelled) {
        setEscrowByAddress(new Map(entries.filter((e): e is [string, EscrowInfo] => e !== null)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet, activity]);

  async function handleSync() {
    setSyncing(true);
    try {
      await refresh();
    } finally {
      setSyncing(false);
    }
  }

  async function handleMerge() {
    setMergeSteps([{ id: "merge", label: "Merging receiving into spendable", status: "active" }]);
    setMerging(true);
    try {
      await wallet!.merge();
      setMergeSteps((s) => s.map((x) => ({ ...x, status: "done" })));
      await refresh();
    } catch {
      setMergeSteps((s) => s.map((x) => ({ ...x, status: "error" })));
    } finally {
      setMerging(false);
      setTimeout(() => setMergeSteps([]), 1500);
    }
  }

  async function handleRegister() {
    setError(null);
    setRegisterSteps([{ id: "register", label: "Prove key ownership", status: "active", estSeconds: 4 }]);
    setRegistering(true);
    try {
      await wallet!.register();
      setRegisterSteps((s) => s.map((x) => ({ ...x, status: "done" })));
      await refresh();
    } catch (e) {
      setError(errMsg(e));
      setRegisterSteps((s) => s.map((x) => ({ ...x, status: "error" })));
    } finally {
      setRegistering(false);
      setTimeout(() => setRegisterSteps([]), 1500);
    }
  }

  if (!wallet) {
    return (
      <AppShell>
        <PageHeader title="Overview" subtitle="Your confidential balance and recent activity." showBack={false} />
        {connecting ? (
          <div className="px-4 pb-10 md:mx-auto md:max-w-2xl md:px-8">
            <div className="glass-card flex items-center gap-4 p-6">
              <Skeleton className="h-11 w-11" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </div>
            </div>
          </div>
        ) : (
          <ConnectPrompt message="Connect your wallet to see your confidential balance, merge incoming funds and review your activity." />
        )}
      </AppShell>
    );
  }

  const spendable = view?.spendable ?? 0n;
  const receiving = view?.receiving ?? 0n;
  const registered = view?.registered ?? false;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  if (!view) {
    return (
      <AppShell>
        <PageHeader
          title="Overview"
          subtitle={connecting ? "Syncing your account from the chain." : "Your confidential balance and recent activity."}
          showBack={false}
          right={<AddressDisplay address={wallet.address} chars={5} />}
        />
        <div className="flex flex-col gap-5 px-4 pb-10 md:mx-auto md:max-w-2xl md:px-8">
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
          {connecting ? (
            <section className="glass-card overflow-hidden" aria-busy="true">
              <div className="flex flex-col gap-4 p-6">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent-solid" />
                  <p className="text-sm font-medium">Reading your account from Stellar testnet</p>
                </div>
                <p className="text-sm leading-relaxed text-text-muted">
                  Your browser fetches recent on-chain events and decrypts your balance locally, so nothing
                  about it is sent anywhere. The first sync after connecting is the slowest, usually 10 to 30
                  seconds. Later visits resume where the last one stopped.
                </p>
                <Skeleton className="h-10 w-48" />
              </div>
            </section>
          ) : (
            <section className="glass-card flex flex-col items-start gap-4 p-6">
              <div>
                <p className="font-medium">Account status unavailable</p>
                <p className="mt-1 text-sm text-text-muted">
                  We could not read your account from the chain. Retry before registering or transacting.
                </p>
              </div>
              <Button variant="secondary" onClick={refresh}>
                Retry account check
              </Button>
            </section>
          )}
        </div>
      </AppShell>
    );
  }

  if (!registered) {
    return (
      <AppShell>
        <PageHeader
          title="Register"
          subtitle="One step before you can use Lucent."
          showBack={false}
          right={<AddressDisplay address={wallet.address} chars={5} />}
        />
        <div className="flex flex-col gap-5 px-4 pb-10 animate-fade-in-up md:mx-auto md:max-w-2xl md:px-8">
          <ErrorBanner error={error} onDismiss={() => setError(null)} />

          <section className="glass-card overflow-hidden">
            <div className="p-6 md:p-8">
              <h2 className="font-display font-medium text-4xl leading-tight tracking-tight">Bind your confidential keys.</h2>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-text-secondary">
                Registration ties a key set, derived from a wallet signature, to your Stellar address
                with a single zero-knowledge proof. Balances, sending, payroll and escrow all unlock after it.
              </p>
              <ol className="mt-6 flex flex-col gap-3 text-sm">
                {["Sign a message in your wallet to derive your keys", "Your browser proves ownership of them (about 4 seconds)", "The proof is verified on-chain, once"].map((t, i) => (
                  <li key={t} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border font-mono text-[10px] text-text-muted">
                      {i + 1}
                    </span>
                    <span className="text-text-secondary">{t}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-col gap-4 border-t border-border bg-card/60 px-6 py-5 md:px-8">
              {registerSteps.length > 0 && <TxStatus steps={registerSteps} />}
              <Button size="lg" isLoading={registering} onClick={handleRegister} className="sm:w-fit sm:min-w-[200px]">
                {registering ? "Registering…" : "Register account"}
              </Button>
            </div>
          </section>
        </div>
      </AppShell>
    );
  }

  const total = spendable + receiving;

  return (
    <AppShell wide>
      <PageHeader
        title="Overview"
        subtitle={`${greeting}. Everything below is decrypted locally, only you can see it.`}
        showBack={false}
        right={
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-xs text-text-muted sm:flex">
              {provisional && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />}
              {provisional ? "Showing saved balance, syncing" : lastSync ? `Synced ${timeAgo(lastSync.getTime())}` : "Not synced yet"}
            </span>
            <Button size="sm" variant="secondary" isLoading={syncing} disabled={provisional} onClick={handleSync}>
              Sync
            </Button>
          </div>
        }
      />
      <div className="flex flex-col gap-6 px-4 pb-10 animate-fade-in-up md:px-8">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <Onboarding
          view={view}
          address={wallet.address}
          provisional={provisional}
          onMerge={handleMerge}
          merging={merging}
        />

        {/* Balance */}
        <section className="glass-card overflow-hidden">
          <div className="grid md:grid-cols-[1.5fr_1fr_1fr]">
            <div className="flex flex-col gap-3 p-6 md:p-8">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span className="font-mono uppercase tracking-[0.14em]">Total balance</span>
                <span className="inline-flex items-center gap-1 rounded-md bg-encrypted-bg px-1.5 py-0.5 text-[10px] font-medium text-encrypted">
                  <Lock className="h-2.5 w-2.5" /> Confidential
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display font-medium text-6xl leading-none tracking-tight tabular-nums md:text-7xl">{formatMoney(total)}</span>
                <span className="font-mono text-sm text-text-muted">USDC</span>
              </div>
            </div>

            {[
              { label: "Spendable", hint: "Ready to send or withdraw", value: spendable, Icon: Lock },
              { label: "Receiving", hint: "Incoming, not yet merged", value: receiving, Icon: ArrowDownLeft },
            ].map(({ label, hint, value, Icon }) => (
              <div key={label} className="flex flex-col justify-between gap-6 border-t border-border p-6 md:border-l md:border-t-0 md:p-8">
                <div className="flex items-center gap-2 text-text-muted">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="font-mono text-xs uppercase tracking-[0.14em]">{label}</span>
                </div>
                <div>
                  <div className="font-display text-2xl font-semibold tabular-nums">{formatMoney(value)}</div>
                  <div className="mt-1 text-xs text-text-muted">{hint}</div>
                </div>
              </div>
            ))}
          </div>

          {receiving > 0n && (
            <div className="flex flex-col gap-3 border-t border-border bg-card/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
              <p className="text-sm text-text-secondary">
                You have <span className="font-medium text-text-primary">{formatMoney(receiving)} USDC</span> waiting to be merged into your spendable balance.
              </p>
              <div className="flex flex-col gap-2 sm:items-end">
                <Button size="sm" isLoading={merging} disabled={provisional} onClick={handleMerge}>
                  {provisional ? "Syncing…" : "Merge into spendable"}
                </Button>
                {mergeSteps.length > 0 && <TxStatus steps={mergeSteps} />}
              </div>
            </div>
          )}
        </section>

        {/* Actions */}
        <nav aria-label="Quick actions" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {QUICK_ACTIONS.map(({ href, icon: Icon, label, hint }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-panel px-4 py-3.5 shadow-card transition-colors hover:border-border-hover"
            >
              <span className="flex items-center gap-3">
                <Icon className="h-[18px] w-[18px] text-text-secondary transition-colors group-hover:text-accent" strokeWidth={1.8} />
                <span>
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="hidden text-xs text-text-muted sm:block">{hint}</span>
                </span>
              </span>
              <ArrowUpRight className="h-4 w-4 text-text-muted transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent" />
            </Link>
          ))}
        </nav>

        {/* Activity */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-lg font-semibold tracking-tight">Activity</h2>
            {activity && activity.length > 0 && <span className="text-xs text-text-muted">Latest {activity.length}</span>}
          </div>

          {activityLoading && (
            <div className="glass-card flex flex-col gap-px overflow-hidden">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[60px] rounded-none" />
              ))}
            </div>
          )}

          {!activityLoading && activity && activity.length === 0 && (
            <div className="glass-card flex flex-col items-start gap-3 p-8">
              <Activity className="h-5 w-5 text-text-muted" />
              <div>
                <p className="font-medium">No activity yet</p>
                <p className="mt-1 text-sm text-text-muted">Deposit USDC to create your first confidential balance.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => router.push("/shield")}>
                Deposit USDC
              </Button>
            </div>
          )}

          {!activityLoading && activity && activity.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="hidden grid-cols-[2rem_minmax(0,1.6fr)_7rem_9rem_3.5rem] gap-x-4 border-b border-border bg-card/50 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted md:grid">
                <span />
                <span>Event</span>
                <span>When</span>
                <span className="text-right">Amount (USDC)</span>
                <span />
              </div>
              <ul>
                {activity.map((ev) => (
                  <ActivityRow
                    key={ev.cursor}
                    ev={ev}
                    wallet={wallet}
                    ctx={{ me: wallet.address, escrowByAddress }}
                    decryptedAmount={decryptedAmounts.get(ev.cursor)}
                  />
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
