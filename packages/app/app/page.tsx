"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Eye, EyeOff } from "lucide-react";
import { ChainClient, fetchEvents, type RegisterEvent } from "@lucent/sdk";
import { LucentLogoMark } from "@/components/icons/LucentLogoMark";
import { GithubMark } from "@/components/icons/GithubMark";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { DEPLOYMENT } from "@/lib/deployment";
import { cn } from "@/lib/cn";

/* ───────────────────────── live chain stats ───────────────────────── */

type Stats = { registered: number; transfers: number; merges: number };
type StatsState = { status: "loading" | "ready" | "unavailable"; stats: Stats | null };

function useStats(): StatsState {
  const [state, setState] = useState<StatsState>({ status: "loading", stats: null });
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
        // Keypair accounts only. Escrow instances also register, but that is custody plumbing.
        const registered = new Set(
          events
            .filter((e): e is RegisterEvent => e.type === "register" && e.account.startsWith("G"))
            .map((e) => e.account),
        ).size;
        setState({
          status: "ready",
          stats: {
            registered,
            transfers: events.filter((e) => e.type === "transfer").length,
            merges: events.filter((e) => e.type === "merge").length,
          },
        });
      } catch {
        if (!cancelled) setState({ status: "unavailable", stats: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

/* ───────────────────────── hero ledger ───────────────────────── */

const LEDGER = [
  { kind: "Transfer", from: "GBX4…F2A7", to: "GDQP…9KQ1", amount: "2,400.00", age: "12s" },
  { kind: "Payroll", from: "GCM7…TT3B", to: "GAWE…L0X9", amount: "5,150.00", age: "41s" },
  { kind: "Escrow release", from: "CDK2…71PA", to: "GB3N…ZC4E", amount: "18,000.00", age: "2m" },
  { kind: "Transfer", from: "GDQP…9KQ1", to: "GA9T…R2HM", amount: "310.50", age: "3m" },
];

function Ledger() {
  const [audit, setAudit] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (manual) return;
    const id = setInterval(() => setAudit((a) => !a), 3800);
    return () => clearInterval(id);
  }, [manual]);

  function pick(v: boolean) {
    setManual(true);
    setAudit(v);
  }

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-panel shadow-pop">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">Ledger</span>
          <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-text-muted">Illustrative</span>
        </div>
        <div className="flex rounded-lg border border-border bg-card p-0.5 text-xs font-medium" role="tablist" aria-label="Viewer">
          {[
            { v: false, label: "Public explorer", Icon: EyeOff },
            { v: true, label: "Auditor key", Icon: Eye },
          ].map(({ v, label, Icon }) => (
            <button
              key={label}
              role="tab"
              aria-selected={audit === v}
              onClick={() => pick(v)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors",
                audit === v ? "bg-panel text-text-primary shadow-card" : "text-text-muted hover:text-text-secondary",
              )}
            >
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{v ? "Auditor" : "Public"}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-x-4 px-5 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
        <span>From / To</span>
        <span className="w-28 text-right">Amount (USDC)</span>
      </div>

      <ul className="px-2 pb-2 pt-1">
        {LEDGER.map((row) => (
          <li
            key={row.from + row.to}
            className="grid grid-cols-[1fr_auto] items-center gap-x-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-fg/[0.03]"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-mono text-[13px] text-text-primary">
                <span>{row.from}</span>
                <ArrowRight className="h-3 w-3 text-text-muted" />
                <span>{row.to}</span>
              </div>
              <div className="mt-1 text-xs text-text-muted">
                {row.kind} · {row.age} ago
              </div>
            </div>
            <div className="flex h-6 w-28 items-center justify-end">
              <AnimatePresence mode="wait" initial={false}>
                {audit ? (
                  <motion.span
                    key="v"
                    initial={{ opacity: 0, filter: "blur(6px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className="font-mono text-sm font-medium tabular-nums text-accent"
                  >
                    {row.amount}
                  </motion.span>
                ) : (
                  <motion.span
                    key="h"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center gap-1"
                    aria-label="Encrypted amount"
                  >
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span key={i} className="h-2 w-3 rounded-[3px] bg-encrypted/35" />
                    ))}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </li>
        ))}
      </ul>

      <div className="border-t border-border bg-card/60 px-5 py-3 text-xs text-text-muted">
        {audit ? "Decrypted with the registered auditor key." : "Addresses are public. Amounts are Pedersen commitments."}
      </div>
    </div>
  );
}

/* ───────────────────────── content ───────────────────────── */

const PUBLIC = ["Who paid whom", "When it settled", "That a valid proof exists", "Public USDC deposits"];
const PRIVATE = ["Transfer amounts", "Account balances", "Individual salaries", "Escrowed value"];

const PRODUCTS = [
  { href: "/shield", name: "Shield", desc: "Move USDC into a confidential balance and back out again." },
  { href: "/send", name: "Send", desc: "Pay any registered account without revealing the amount." },
  { href: "/payroll", name: "Payroll", desc: "One atomic run. No employee can read another's salary." },
  { href: "/escrow", name: "Escrow", desc: "Two-party, optionally arbitrated, with the locked amount hidden." },
  { href: "/auditor", name: "Auditor", desc: "A single key decrypts every amount for compliance." },
  { href: "/verify", name: "Disclosure", desc: "Prove one transfer paid one amount, and nothing else." },
];

const NAV_LINK = "text-sm text-text-secondary transition-colors hover:text-text-primary";

/* ───────────────────────── page ───────────────────────── */

export default function LandingPage() {
  const { status, stats } = useStats();
  // Never show 0 for "we could not read the chain": that reads as "nobody uses this".
  const fmt = (n?: number) => (status === "loading" ? "…" : status === "unavailable" || n === undefined ? "Unavailable" : n.toLocaleString());

  return (
    <div className="bg-void text-text-primary">
      {/* ── Hero: full viewport ── */}
      <section className="relative isolate flex min-h-svh flex-col overflow-hidden">
        {/* background: hairline grid + light beam */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.5] [background-image:linear-gradient(rgb(var(--fg)/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--fg)/0.05)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(80%_70%_at_70%_30%,#000,transparent)]"
        />
        <div
          aria-hidden
          className="absolute -right-40 -top-40 -z-10 h-[720px] w-[720px] rounded-full bg-accent-solid/20 blur-[140px]"
        />
        <div
          aria-hidden
          className="absolute -bottom-52 left-1/4 -z-10 h-[520px] w-[520px] rounded-full bg-encrypted/15 blur-[140px]"
        />

        <header className="flex h-20 items-center justify-between px-6 lg:px-12">
          <Link href="/" className="flex items-center gap-2.5">
            <LucentLogoMark size={30} />
            <span className="font-display text-lg font-semibold tracking-tight">Lucent</span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link href="/docs" className={cn(NAV_LINK, "hidden sm:block")}>
              Docs
            </Link>
            <Link href="/stats" className={cn(NAV_LINK, "hidden sm:block")}>
              Stats
            </Link>
            <Link href="/about" className={cn(NAV_LINK, "hidden sm:block")}>
              About
            </Link>
            <ThemeToggle />
            <Link
              href="/home"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent-solid px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-solid-hover"
            >
              Launch app <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </header>

        <div className="grid flex-1 items-center gap-12 px-6 py-10 lg:grid-cols-12 lg:gap-8 lg:px-12">
          <div className="lg:col-span-7">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-7 inline-flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.16em] text-text-muted"
            >
              <span className="h-px w-8 bg-accent-solid" />
              Confidential payments on Stellar
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
              className="font-display font-medium text-[clamp(3.6rem,9.4vw,9rem)] leading-[0.9] tracking-[-0.02em]"
            >
              The amount
              <br />
              is the <span className="text-accent">only secret.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-8 max-w-md text-lg leading-relaxed text-text-secondary"
            >
              Sender and receiver stay public and verifiable. Only the number moves in the dark,
              proven with zero knowledge and checked on-chain.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4"
            >
              <Link
                href="/home"
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-accent-solid px-6 text-[15px] font-semibold text-on-accent shadow-accent transition-colors hover:bg-accent-solid-hover"
              >
                Launch app <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/docs"
                className="group inline-flex items-center gap-1.5 text-[15px] font-medium text-text-primary"
              >
                <span className="border-b border-fg/30 pb-0.5 transition-colors group-hover:border-accent">Read the docs</span>
                <ArrowUpRight className="h-4 w-4 text-text-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          </div>

          <motion.div
            className="lg:col-span-5"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <Ledger />
          </motion.div>
        </div>

        {/* live numbers pinned to the bottom of the viewport */}
        <dl className="grid grid-cols-2 border-t border-border sm:grid-cols-4">
          {[
            { k: "Registered accounts", v: fmt(stats?.registered) },
            { k: "Confidential transfers", v: fmt(stats?.transfers) },
            { k: "Merges", v: fmt(stats?.merges) },
            { k: "Network", v: "Stellar testnet" },
          ].map((s, i) => (
            <div
              key={s.k}
              className={cn(
                "flex flex-col gap-1 px-6 py-5 lg:px-12",
                i > 0 && "sm:border-l sm:border-border",
                i % 2 === 1 && "border-l border-border sm:border-l",
                i >= 2 && "border-t border-border sm:border-t-0",
              )}
            >
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">{s.k}</dt>
              <dd className={cn("font-display font-semibold tabular-nums", s.v === "Unavailable" ? "text-base text-text-muted" : "text-xl")}>{s.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── App preview ── */}
      <section className="border-t border-border px-6 py-28 lg:px-12">
        <div className="grid items-center gap-14 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-text-muted">In the app</p>
            <h2 className="font-display font-medium text-5xl leading-[1] tracking-[-0.01em] md:text-6xl">
              Your balance is yours to read.
            </h2>
            <p className="mt-6 max-w-sm leading-relaxed text-text-secondary">
              Everyone else sees commitments. Your browser holds the keys, so your own balances and amounts are
              decrypted on your device and never sent anywhere.
            </p>
          </div>

          <div className="lg:col-span-8">
            <div className="overflow-hidden rounded-2xl border border-border bg-panel shadow-pop">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <span className="font-display text-sm font-semibold">Overview</span>
                <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-text-muted">Illustrative data</span>
              </div>
              <div className="grid sm:grid-cols-[1.5fr_1fr_1fr]">
                <div className="p-6">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">Total balance</p>
                  <p className="mt-3 font-display text-5xl font-medium tabular-nums tracking-tight">14,095.00</p>
                </div>
                {[
                  { k: "Spendable", v: "12,845.00" },
                  { k: "Receiving", v: "1,250.00" },
                ].map((c) => (
                  <div key={c.k} className="border-t border-border p-6 sm:border-l sm:border-t-0">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">{c.k}</p>
                    <p className="mt-6 font-display text-xl font-semibold tabular-nums">{c.v}</p>
                  </div>
                ))}
              </div>
              <ul className="border-t border-border">
                {[
                  { label: "Received from GBX4N…F2A7", when: "4m ago", amt: "+1,250.00", pos: true },
                  { label: "Sent to GCM7T…A9R1", when: "1h ago", amt: "-320.00", pos: false },
                  { label: "Escrow released to you", when: "5h ago", amt: "+1,800.00", pos: true },
                ].map((r) => (
                  <li key={r.label} className="flex items-center justify-between gap-4 border-t border-border px-5 py-3.5 first:border-t-0">
                    <div>
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className="text-xs text-text-muted">{r.when}</p>
                    </div>
                    <span className={cn("font-mono text-sm tabular-nums", r.pos ? "text-success" : "text-text-primary")}>{r.amt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Public vs private ── */}
      <section className="border-t border-border px-6 py-28 lg:px-12">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-text-muted">The model</p>
            <h2 className="font-display font-medium text-5xl leading-[1] tracking-[-0.01em] md:text-6xl">
              Private amounts. <span className="text-text-secondary">Public accountability.</span>
            </h2>
            <p className="mt-6 max-w-sm leading-relaxed text-text-secondary">
              Most privacy tools hide everyone and break compliance. Lucent hides one thing, the
              amount, and leaves the rest of the record intact.
            </p>
          </div>

          <div className="grid overflow-hidden rounded-2xl border border-border bg-panel shadow-card sm:grid-cols-2 lg:col-span-8">
            {[
              { title: "Visible to everyone", tone: "text-text-primary", dot: "bg-success", items: PUBLIC },
              { title: "Visible to no one", tone: "text-encrypted", dot: "bg-encrypted", items: PRIVATE },
            ].map((col, i) => (
              <div key={col.title} className={cn("p-8 md:p-10", i === 1 && "border-t border-border sm:border-l sm:border-t-0")}>
                <div className={cn("mb-8 flex items-center gap-2.5 text-sm font-semibold", col.tone)}>
                  <span className={cn("h-2 w-2 rounded-full", col.dot)} />
                  {col.title}
                </div>
                <ul className="flex flex-col">
                  {col.items.map((it) => (
                    <li key={it} className="border-t border-border py-4 font-display text-xl tracking-tight first:border-t-0 first:pt-0">
                      {it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Products ── */}
      <section className="border-t border-border px-6 py-28 lg:px-12">
        <div className="mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <h2 className="max-w-xl font-display font-medium text-5xl leading-[1] tracking-[-0.01em] md:text-6xl">
            One primitive, six ways to use it.
          </h2>
          <p className="max-w-xs text-text-secondary">Every flow runs in the browser, proves locally, and settles on Soroban.</p>
        </div>

        <ul className="border-b border-border">
          {PRODUCTS.map((p, i) => (
            <li key={p.href} className="border-t border-border">
              <Link
                href={p.href}
                className="group grid grid-cols-[2.5rem_1fr_auto] items-center gap-x-4 py-7 transition-colors hover:bg-fg/[0.025] md:grid-cols-[4rem_minmax(0,1fr)_minmax(0,1.2fr)_auto] md:gap-x-8 md:px-4"
              >
                <span className="font-mono text-xs text-text-muted">{String(i + 1).padStart(2, "0")}</span>
                <span className="font-display font-medium text-4xl tracking-tight transition-transform duration-300 group-hover:translate-x-1 md:text-5xl">
                  {p.name}
                </span>
                <span className="col-span-2 col-start-2 row-start-2 mt-2 text-text-secondary md:col-span-1 md:col-start-auto md:row-start-auto md:mt-0">
                  {p.desc}
                </span>
                <ArrowUpRight className="h-5 w-5 text-text-muted transition-all duration-300 group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-accent" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Closing band ── */}
      <section className="bg-text-primary px-6 py-28 text-void lg:px-12">
        <div className="flex flex-col justify-between gap-10 md:flex-row md:items-end">
          <h2 className="max-w-3xl font-display font-medium text-6xl leading-[0.95] tracking-[-0.02em] md:text-8xl">
            Try it on <span>testnet.</span>
          </h2>
          <div className="flex flex-col items-start gap-4">
            <Link
              href="/home"
              className="inline-flex h-14 items-center gap-2 rounded-lg bg-accent-solid px-8 text-base font-semibold text-on-accent transition-colors hover:bg-accent-solid-hover"
            >
              Launch app <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="max-w-xs text-sm opacity-60">
              Unaudited and testnet only. Do not use with real value.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="flex flex-col items-start justify-between gap-6 px-6 py-8 text-sm text-text-muted md:flex-row md:items-center lg:px-12">
        <div className="flex items-center gap-2.5">
          <LucentLogoMark size={22} />
          <span>Lucent</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/stats" className="transition-colors hover:text-text-primary">Stats</Link>
          <Link href="/docs" className="transition-colors hover:text-text-primary">Docs</Link>
          <Link href="/about" className="transition-colors hover:text-text-primary">About</Link>
          <a
            href="https://github.com/Psalmuel01/Lucent"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-text-primary"
          >
            <GithubMark className="h-4 w-4" /> GitHub
          </a>
          <a
            href="https://github.com/OpenZeppelin/stellar-contracts"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-text-primary"
          >
            Built on Stellar
          </a>
        </div>
      </footer>
    </div>
  );
}
