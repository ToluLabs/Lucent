"use client";

import { PublicShell } from "@/components/layout/PublicShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { DEPLOYMENT } from "@/lib/deployment";
import { ChainClient, fetchEvents, type RegisterEvent } from "@lucent/sdk";
import {
  ArrowDownUp,
  ArrowUpRight,
  Layers,
  ScanLine,
  Send,
  UserCheck,
} from "lucide-react";
import { useEffect, useState } from "react";

function contractUrl(id: string) {
  return `https://stellar.expert/explorer/testnet/contract/${id}`;
}

const STAT_DEFS = [
  {
    key: "registered",
    label: "Registration addresses seen",
    sub: "Confidential accounts bound to a Grumpkin key",
    icon: UserCheck,
    color: "text-encrypted bg-encrypted-bg",
  },
  {
    key: "transfers",
    label: "Confidential Transfers",
    sub: "Send, payroll, and escrow payments — amount hidden",
    icon: Send,
    color: "text-accent bg-accent-bg",
  },
  {
    key: "merges",
    label: "Merges",
    sub: "Receiving balance folded into spendable",
    icon: Layers,
    color: "text-encrypted bg-encrypted-bg",
  },
  {
    key: "deposits",
    label: "Shield Deposits",
    sub: "Public USDC shielded into a confidential balance",
    icon: ArrowDownUp,
    color: "text-success bg-success/10",
  },
  {
    key: "withdrawals",
    label: "Withdrawals",
    sub: "Confidential balance unshielded back to USDC",
    icon: ArrowUpRight,
    color: "text-warning bg-warning/10",
  },
  {
    key: "verifies",
    label: "Proof-carrying events",
    sub: "Register, transfer and withdrawal events",
    icon: ScanLine,
    color: "text-accent bg-accent-bg",
  },
] as const;

type StatKey = (typeof STAT_DEFS)[number]["key"];
type Stats = Record<StatKey, number>;

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = new ChainClient({
          rpcUrl: DEPLOYMENT.rpcUrl,
          networkPassphrase: DEPLOYMENT.networkPassphrase,
          contracts: DEPLOYMENT.contracts,
        });
        const { events } = await fetchEvents(client, {
          startLedger: DEPLOYMENT.deployedAtLedger,
        });
        if (cancelled) return;
        const count = (t: string) => events.filter((e) => e.type === t).length;
        // G... keypair accounts only — every PrivateEscrow instance also
        // registers as its own confidential account (C...) to hold a
        // balance, but that's custody plumbing, not a person or org.
        const registered = new Set(
          events
            .filter(
              (e): e is RegisterEvent =>
                e.type === "register" && e.account.startsWith("G"),
            )
            .map((e) => e.account),
        ).size;
        setStats({
          registered,
          transfers: count("transfer"),
          deposits: count("deposit"),
          withdrawals: count("withdraw"),
          merges: count("merge"),
          // register/withdraw/transfer are the only entry points that carry
          // a proof argument — deposit and merge move funds without one.
          verifies: count("register") + count("withdraw") + count("transfer"),
        });
      } catch {
        if (!cancelled) setStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PublicShell>
      <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8">
        <p className="eyebrow">Network evidence · limited coverage</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
          Recent Testnet activity
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-8 text-text-secondary">
          Counts from token-contract events available through the RPC retention
          window, typically about seven days. These are protocol events, not
          unique users or all-time traction. Older activity may be absent.
        </p>
        {!loading && !stats && (
          <div
            role="alert"
            className="mt-8 rounded-lg border border-warning/30 p-5 text-sm text-warning"
          >
            Activity data is unavailable. No counts are shown; unavailable data
            does not mean zero activity. Reload this page to retry.
          </div>
        )}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STAT_DEFS.map(({ key, label, sub, icon: Icon }) => (
            <div key={key} className="glass-card p-6">
              <Icon className="mb-6 h-5 w-5 text-accent" />
              <h2 className="text-sm text-text-secondary">{label}</h2>
              {loading ? (
                <Skeleton className="my-4 h-10 w-20" />
              ) : (
                <p className="my-4 text-4xl font-semibold tabular-nums">
                  {stats ? stats[key].toLocaleString() : "—"}
                </p>
              )}
              <p className="text-xs leading-6 text-text-muted">{sub}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-2xl text-sm leading-7 text-text-secondary">
          Registration counts reflect distinct wallet addresses with
          registration events in the available data, not the number of currently
          registered accounts. Proof counts are inferred from proof-carrying
          event types. Payroll and escrow transfers are included in token
          transfers.
        </p>
        <a
          href={contractUrl(DEPLOYMENT.contracts.token)}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-block text-sm text-accent"
        >
          Inspect the token contract on Stellar Expert ↗
        </a>
      </section>
    </PublicShell>
  );
}
