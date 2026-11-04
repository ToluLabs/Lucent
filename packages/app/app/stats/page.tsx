"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDownUp, ArrowUpRight, Send, Layers, UserCheck, ScanLine, ExternalLink } from "lucide-react";
import { ChainClient, fetchEvents, type RegisterEvent } from "@lucent/sdk";
import { MarketingFooter, MarketingNav } from "@/components/layout/MarketingNav";
import { Skeleton } from "@/components/ui/Skeleton";
import { DEPLOYMENT } from "@/lib/deployment";
import { cn } from "@/lib/cn";

function contractUrl(id: string) {
  return `https://stellar.expert/explorer/testnet/contract/${id}`;
}

const STAT_DEFS = [
  {
    key: "registered",
    label: "Registered Addresses",
    sub: "Confidential accounts bound to a Grumpkin key",
    icon: UserCheck,
    color: "text-encrypted bg-encrypted-bg",
  },
  {
    key: "transfers",
    label: "Confidential Transfers",
    sub: "Send, payroll, and escrow payments, amount hidden",
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
    label: "Tx Verifies",
    sub: "Zero-knowledge proofs verified on-chain",
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
        const { events } = await fetchEvents(client, { startLedger: DEPLOYMENT.deployedAtLedger });
        if (cancelled) return;
        const count = (t: string) => events.filter((e) => e.type === t).length;
        // G... keypair accounts only, every PrivateEscrow instance also
        // registers as its own confidential account (C...) to hold a
        // balance, but that's custody plumbing, not a person or org.
        const registered = new Set(
          events
            .filter((e): e is RegisterEvent => e.type === "register" && e.account.startsWith("G"))
            .map((e) => e.account),
        ).size;
        setStats({
          registered,
          transfers: count("transfer"),
          deposits: count("deposit"),
          withdrawals: count("withdraw"),
          merges: count("merge"),
          // register/withdraw/transfer are the only entry points that carry
          // a proof argument, deposit and merge move funds without one.
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
    <div className="min-h-dvh bg-void text-text-primary">
      <MarketingNav />

      <section className="brand-wash border-b border-border px-6 pb-16 pt-20 lg:px-12 lg:pt-28">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-text-muted">Protocol stats</p>
        <h1 className="max-w-4xl font-serif text-[clamp(2.8rem,6.5vw,6rem)] leading-[0.95] tracking-[-0.02em]">
          Activity on Stellar <span className="italic text-accent">testnet.</span>
        </h1>
        <p className="mt-8 max-w-xl leading-relaxed text-text-secondary">
          Every count is read from on-chain events and can be checked on Stellar Expert. Amounts are
          never revealed, not even here.
        </p>
      </section>

      <section className="grid grid-cols-1 border-b border-border sm:grid-cols-2 lg:grid-cols-3">
        {STAT_DEFS.map(({ key, label, sub }, i) => (
          <motion.div
            key={key}
            className={cn(
              "flex flex-col justify-between gap-10 border-border px-6 py-10 lg:px-12 lg:py-12",
              i > 0 && "border-t sm:border-t-0",
              i >= 2 && "sm:border-t",
              i % 2 === 1 && "sm:border-l",
              i % 3 !== 0 && "lg:border-l",
              i % 3 === 0 && "lg:border-l-0",
              i >= 3 && "lg:border-t",
              i === 2 && "lg:border-t-0",
            )}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.05 }}
          >
            <div>
              <h2 className="font-display text-lg font-semibold tracking-tight">{label}</h2>
              <p className="mt-1 max-w-xs text-sm leading-relaxed text-text-muted">{sub}</p>
            </div>
            {loading ? (
              <Skeleton className="h-14 w-32" />
            ) : (
              <span className="font-serif text-7xl leading-none tabular-nums tracking-tight">
                {(stats?.[key] ?? 0).toLocaleString()}
              </span>
            )}
          </motion.div>
        ))}
      </section>

      <section className="flex flex-col gap-5 px-6 py-12 lg:px-12">
        <p className="max-w-2xl text-sm leading-relaxed text-text-muted">
          Read from the confidential token contract's event log, starting at deploy ledger{" "}
          {DEPLOYMENT.deployedAtLedger.toLocaleString()}. Payroll and escrow activity appears here too, since
          both settle through the same confidential transfers.
        </p>
        <a
          href={contractUrl(DEPLOYMENT.contracts.token)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-border bg-panel px-4 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
        >
          View token contract <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </section>

      <MarketingFooter />
    </div>
  );
}
