"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import { useAction } from "@/lib/use-action";
import { ConnectPrompt } from "@/components/ui/ConnectPrompt";
import { Input } from "@/components/ui/Input";
import { ProofLoadingOverlay } from "@/components/ui/ProofLoadingOverlay";
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
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { DiscloseFlow } from "./disclose-flow";
import { useWallet } from "@/lib/wallet-context";
import { shortAddress, timeAgo } from "@/lib/format";
import { displayAmount } from "@/lib/amount";
import { DEPLOYMENT } from "@/lib/deployment";
import { cn } from "@/lib/cn";
import { errMsg } from "@/lib/err";

const QUICK_ACTIONS = [
  { href: "/shield", icon: ArrowDownUp, label: "Shield", tint: "text-accent bg-accent-bg" },
  { href: "/send", icon: Send, label: "Send", tint: "text-success bg-success/10" },
  { href: "/payroll", icon: Briefcase, label: "Payroll", tint: "text-encrypted bg-encrypted-bg" },
  { href: "/escrow", icon: Lock, label: "Escrow", tint: "text-warning bg-warning/10" },
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

type IconType = ComponentType<{ className?: string }>;

/**
 * Cross-referenced context that lets a plain `confidential_transfer`/`merge`
 * be relabeled with what it actually was. The token contract has no notion of
 * "payroll" or "escrow" — a salary is just a transfer between two regular
 * (G...) addresses, indistinguishable on-chain from a deliberate personal
 * Send between the same two people. Only escrow gets relabeled, because it's
 * the one case with a hard signal: the counterparty being a contract (C...)
 * address — every escrow instance IS its own confidential account — not a
 * guess about intent. `escrowByAddress` resolves it to depositor/recipient.
 *
 * Payroll deliberately does NOT get the same treatment. An earlier version
 * relabeled any transfer to/from a known employer/employee of yours as
 * "Salary," but that's wrong the moment that employer and employee also send
 * each other money directly for any other reason — which is exactly a
 * personal transfer, and mislabeling it erodes trust in the whole feed.
 * There's no on-chain marker that distinguishes a transfer submitted via
 * PayrollVault's execute_run from one submitted directly by a wallet with the
 * same from/to — the PayrollVault contract's own EmployeePaid/RunExecuted
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
    <li className="border-b border-border last:border-0">
      <div
        className="flex cursor-pointer items-center gap-3 rounded-lg py-3 transition-colors"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card">
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <a href={explorerUrl} target="_blank" rel="noreferrer" className="block text-sm font-medium text-text-primary hover:underline">{label} ↗</a>
          <div className="text-xs text-text-muted">{relativeTime(ev)}</div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {ev.type === "transfer" &&
            (decryptedAmount === undefined ? (
              <Skeleton className="h-4 w-16" />
            ) : decryptedAmount === null ? (
              <EncryptedBadge />
            ) : (
              <span className={cn("font-mono text-sm font-medium tabular-nums", iconColor)}>
                {direction === "received" ? "+" : "−"}
                {displayAmount(decryptedAmount)}
              </span>
            ))}
          {ev.type === "deposit" && (
            <span className="font-mono text-sm font-medium tabular-nums text-accent">
              +{displayAmount(ev.amount)}
            </span>
          )}
          {ev.type === "withdraw" && (
            <span className="font-mono text-sm font-medium tabular-nums text-accent">
              −{displayAmount(ev.amount)}
            </span>
          )}
          {direction && canDisclose && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setProveOpen((v) => !v);
              }}
              className="text-xs font-medium tracking-wide text-text-muted transition-colors duration-150 hover:text-accent"
            >
              {proveOpen ? "Close" : "Disclose"}
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
  const {run,busy,phase,uncertain}=useAction();
  const [query,setQuery]=useState("");
  const [page,setPage]=useState(1);
  const [historyAttempt,setHistoryAttempt]=useState(0);
  const [historyError,setHistoryError]=useState<string|null>(null);
  const { wallet, view, connecting, connect, refresh, lastSync, error, setError } = useWallet();

  const [syncing, setSyncing] = useState(false);

  const [mergeSteps, setMergeSteps] = useState<TxStep[]>([]);

  const [registerSteps, setRegisterSteps] = useState<TxStep[]>([]);

  const [activity, setActivity] = useState<ConfidentialEvent[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(true);
  const [decryptedAmounts, setDecryptedAmounts] = useState<Map<string, bigint | null>>(new Map());
  const [escrowByAddress, setEscrowByAddress] = useState<Map<string, EscrowInfo>>(new Map());

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    (async () => {
      setActivityLoading(true);
      setHistoryError(null);
      setActivity(null);
      setDecryptedAmounts(new Map());
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
        if (!cancelled) setActivity(mine.reverse());
      } catch (e) {
        if (!cancelled) setHistoryError(errMsg(e));
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet,lastSync,historyAttempt]);

  // Decrypt each transfer's amount for display — this is the account's own
  // data, so there's no reason to keep it hidden from the owner the way it's
  // hidden from everyone else. Received transfers decrypt with just the
  // owner's own key; sent transfers need one extra RPC lookup per event (the
  // recipient's viewing key), so this runs as its own effect rather than
  // blocking the activity list from rendering.
  useEffect(() => {
    if (!wallet || !activity) return;
    const transfers = activity.slice((page-1)*20,page*20).filter((ev): ev is TransferEvent => ev.type === "transfer");
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
  }, [wallet, activity,page]);

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

  async function handleMerge(){await run("merge",()=>wallet!.merge());}
  async function handleRegister(){await run("register",sp=>wallet!.register(sp));}
  if(!wallet)return <AppShell><PageHeader title="Overview"/><ConnectPrompt message="Connect to see your balances, send confidential payments and manage payroll."/></AppShell>;
  if(!view)return <AppShell><PageHeader title="Overview"/><div className="workspace-page space-y-5"><ErrorBanner error={error} onDismiss={()=>setError(null)}/><GlassCard><h2 className="text-lg font-semibold">Account status unavailable</h2><p className="my-4 text-sm text-text-secondary">We need a successful account check before offering registration or payments.</p><Button onClick={refresh} isLoading={connecting}>Retry account check</Button></GlassCard></div></AppShell>;
  if(!view.registered)return <AppShell><PageHeader title="Overview"/><div className="workspace-page"><ErrorBanner error={error} onDismiss={()=>setError(null)}/><div className="workspace-grid mt-5"><GlassCard padding="lg"><p className="eyebrow">Account setup · Step 2 of 3</p><h2 className="mt-4 text-2xl font-semibold">Make your wallet payment-ready.</h2><p className="my-5 max-w-lg text-sm leading-7 text-text-secondary">Register your confidential keys with Lucent using a one-time proof generated in this browser. Freighter will ask you to approve the transaction.</p><AddressDisplay address={wallet.address} chars={8}/><Button className="mt-6" disabled={!!busy||uncertain} isLoading={busy==="register"} onClick={handleRegister}>Register confidential account</Button></GlassCard><aside className="space-y-4 p-5"><h3 className="font-semibold">Before you continue</h3><p className="text-sm leading-7 text-text-secondary">Use test funds only. This software is experimental and unaudited. Demo auditor keys are publicly available and can reveal covered amounts.</p><p className="text-sm leading-7 text-text-secondary">Keep this browser's confidential state. Clearing storage can interrupt recovery when older events are unavailable.</p><Link href="/docs" className="text-sm text-accent">Read the setup guide →</Link></aside></div></div><ProofLoadingOverlay open={busy==="register" && phase==="proving"} fullScreen/></AppShell>;
  const filtered=(activity??[]).filter(ev=>JSON.stringify(ev,(_,v)=>typeof v==="bigint"?v.toString():v).toLowerCase().includes(query.toLowerCase()));
  const pages=Math.max(1,Math.ceil(filtered.length/20));
  const currentPage=Math.min(page,pages);
  return <AppShell><PageHeader title="Overview" right={<Button variant="secondary" isLoading={syncing} onClick={handleSync}>Refresh account</Button>}/><div className="workspace-page space-y-6">
    <ErrorBanner error={error} onDismiss={()=>setError(null)}/>
    {!view.matchesChain && <div role="alert" className="rounded-lg border border-warning/40 p-4 text-sm leading-6 text-warning">Local state does not match the chain. Confidential balances cannot be relied on for spending. Refresh and inspect account settings before proceeding. Do not clear browser storage.</div>}
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr]">
     <GlassCard padding="lg" className="border-accent/20"><p className="text-sm text-text-secondary">Available confidential balance</p><p className="mt-5 break-words text-3xl font-semibold tabular-nums tracking-tight lg:text-4xl">{view.matchesChain?displayAmount(view.spendable,7):"Unavailable"}</p><p className="mt-3 text-xs text-text-muted">Ready for payments · USDC on Testnet</p><div className="mt-7 flex flex-wrap gap-3"><Link href="/send" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-black"><Send className="h-4 w-4"/>Send payment</Link><Link href="/shield" className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm">Add funds</Link></div></GlassCard>
     <GlassCard padding="lg"><p className="text-sm text-text-secondary">Incoming · requires merge</p><p className="mt-5 break-words text-2xl font-semibold tabular-nums">{view.matchesChain?displayAmount(view.receiving,7):"Unavailable"}</p><p className="mt-3 text-xs leading-6 text-text-muted">Not included in available funds. Merge incoming deposits and transfers before spending.</p><Button className="mt-5" variant="secondary" disabled={!view.matchesChain||view.receiving<=0n||!!busy||uncertain} isLoading={busy==="merge"} onClick={handleMerge}>Merge incoming funds</Button></GlassCard>
     <GlassCard padding="lg"><p className="text-sm text-text-secondary">Public wallet balance</p><p className="mt-5 break-words text-2xl font-semibold tabular-nums">{displayAmount(view.publicUSDC,7)}</p><p className="mt-3 text-xs leading-6 text-text-muted">Public USDC, separate from your confidential account. Deposit and withdrawal amounts are public.</p><Link href="/shield" className="mt-6 inline-block py-2 text-sm text-accent">Manage funding →</Link></GlassCard>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-text-muted"><span>{lastSync?`Account checked ${timeAgo(lastSync.getTime())}`:"Not checked"}</span><span>Amounts confidential · addresses and metadata public</span></div>
    <GlassCard padding="lg"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Account activity</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{DEPLOYMENT.indexerUrl?"Retrieved from the configured indexer and recent RPC events. Coverage depends on the data source.":"Recent events available from the RPC retention window (typically about 7 days). Older payments may be absent; this is not an all-time statement."}</p></div><Button variant="ghost" size="sm" isLoading={activityLoading} onClick={()=>setHistoryAttempt(n=>n+1)}>Refresh activity</Button></div>
    <div className="my-5 max-w-md"><Input label="Search available activity" placeholder="Address, transaction hash or event type" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></div>
    {historyError && <ErrorBanner error={historyError} onDismiss={()=>setHistoryError(null)}/>}
    {activityLoading?<Skeleton className="h-36 w-full"/>:!historyError && (filtered.length===0?<div className="py-10 text-center"><Activity className="mx-auto mb-4 h-7 w-7 text-text-muted"/><p className="text-sm">{query?"No matching events":"No events in the available history"}</p><p className="mt-2 text-xs text-text-muted">Missing historical events do not establish that an account was never used.</p></div>:<><ul>{filtered.slice((currentPage-1)*20,currentPage*20).map(ev=><ActivityRow key={ev.cursor} ev={ev} wallet={wallet} ctx={{me:wallet.address,escrowByAddress}} decryptedAmount={decryptedAmounts.get(ev.cursor)}/>)}</ul><div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4"><span className="text-xs text-text-muted">{filtered.length} available events · Page {currentPage} of {pages}</span><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Previous</Button><Button size="sm" variant="secondary" disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}>Next</Button></div></div></>)}
    </GlassCard><p className="text-xs leading-6 text-text-muted">Experimental Testnet software. Preserve browser state and use test funds only. <Link href="/docs" className="text-accent">Privacy and recovery guidance →</Link></p>
  </div></AppShell>;
}
