import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  Fingerprint,
  Layers3,
  LockKeyhole,
  ScanLine,
  Send,
  ShieldCheck,
} from "lucide-react";
import { PublicShell } from "@/components/layout/PublicShell";
import { PrivacyVisual } from "@/components/brand/PrivacyVisual";

const workflows = [
  {
    icon: Send,
    number: "01",
    title: "Make your next move.",
    description:
      "Send USDC between registered accounts. The amount stays confidential. The payment stays on Stellar.",
    href: "/send",
    label: "Confidential payments",
    tag: "PAYMENTS",
  },
  {
    icon: Briefcase,
    number: "02",
    title: "Pay the team. Keep the details.",
    description:
      "One recipient template. A considered review. An atomic payroll run with confidential salary amounts.",
    href: "/payroll",
    label: "Explore payroll",
    tag: "PAYROLL",
  },
  {
    icon: LockKeyhole,
    number: "03",
    title: "Give agreements a clear path.",
    description:
      "Create experimental escrow agreements with delivery, release, refunds and optional arbitration. Understand the custody limitations before testing.",
    href: "/escrow",
    label: "Explore escrow",
    tag: "ESCROW",
  },
  {
    icon: ScanLine,
    number: "04",
    title: "Share the fact. Keep the rest.",
    description:
      "Request a disclosure and verify a transfer-specific amount against its public event, without disclosing other balances.",
    href: "/verify",
    label: "Selective disclosure",
    tag: "VERIFICATION",
  },
];

export default function LandingPage() {
  return (
    <PublicShell>
      <section className="landing-wrap landing-hero">
        <div className="hero-copy">
          <div className="hero-chip">
            <span className="status-spark" />
            Confidential finance, on Stellar
          </div>
          <h1 className="hero-title mt-7">
            Move money.
            <br />
            Keep your
            <br />
            <em>business yours.</em>
          </h1>
          <p className="mt-7 max-w-[430px] text-[16px] leading-8 text-text-secondary">
            Payments, payroll, and selective disclosure.
            <br className="hidden sm:block" /> A private layer for the way your
            business moves.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              prefetch={false}
              href="/home"
              className="hero-cta lucent-button-primary text-black"
            >
              Enter the workspace <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/docs"
              className="hero-cta border border-border bg-white/[.025] text-text-secondary hover:border-border-hover"
            >
              Explore the protocol
            </Link>
          </div>
          <p className="mt-5 text-[11px] leading-6 text-text-muted">
            Stellar Testnet preview · Test funds only · Unaudited
          </p>
        </div>
        <PrivacyVisual />
      </section>

      <div className="landing-wrap">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5 border-y border-border py-7 text-xs text-text-secondary">
          {[
            { icon: Layers3, label: "Native Soroban settlement" },
            { icon: Fingerprint, label: "Browser-generated proofs" },
            { icon: ShieldCheck, label: "Transfer-specific disclosure" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-accent/80" strokeWidth={1.5} />
              {label}
            </div>
          ))}
          <a
            href="#workspace-preview"
            className="flex items-center gap-3 text-text-muted"
          >
            A closer look <ArrowDown className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <section id="workspace-preview" className="landing-wrap landing-section">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="landing-kicker mb-5">Designed for your next move</p>
            <h2 className="landing-heading">
              Everything in view.
              <br />
              <span className="text-text-muted">
                Only what you choose, exposed.
              </span>
            </h2>
          </div>
          <p className="max-w-xs text-sm leading-7 text-text-secondary">
            A connected workspace for confidential payments. Clear balances,
            deliberate reviews, and no mystery about what comes next.
          </p>
        </div>
        <div className="product-window">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 text-xs sm:px-7">
            <div className="flex items-center gap-4">
              <span className="font-semibold tracking-tight">
                Lucent<span className="text-accent">.</span>
              </span>
              <span className="hidden text-text-muted sm:inline">
                / Workspace
              </span>
            </div>
            <span className="flex items-center gap-2 text-text-secondary">
              <span className="status-spark" />
              Testnet preview
            </span>
          </div>
          <div className="grid md:grid-cols-[180px_1fr]">
            <div className="hidden border-r border-border p-5 md:block">
              <p className="mb-5 text-[10px] uppercase tracking-widest text-text-muted">
                Workspace
              </p>
              {[
                { icon: Layers3, label: "Overview" },
                { icon: Send, label: "Payments" },
                { icon: Briefcase, label: "Payroll" },
                { icon: LockKeyhole, label: "Escrow" },
              ].map(({ icon: Icon, label }, i) => (
                <div
                  key={label}
                  className={`mb-2 flex items-center gap-3 rounded-lg px-3 py-3 text-xs ${i === 0 ? "bg-accent-bg text-accent" : "text-text-muted"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </div>
              ))}
            </div>
            <div className="p-5 sm:p-8">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-xl font-medium tracking-tight">
                  Your overview
                </h3>
                <span className="rounded-full border border-border px-3 py-1.5 text-[10px] text-text-muted">
                  Connect to see real balances
                </span>
              </div>
              <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr_1fr]">
                <div className="balance-feature overflow-hidden rounded-2xl border border-accent/15 p-5">
                  <p className="text-xs text-text-secondary">
                    Available confidential balance
                  </p>
                  <p className="my-7 text-4xl font-medium tracking-tight">
                    — <span className="text-sm text-text-muted">USDC</span>
                  </p>
                  <Link
                    prefetch={false}
                    href="/send"
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-xs font-semibold text-black"
                  >
                    Send payment <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
                {[
                  { label: "Incoming funds", sub: "Requires merge" },
                  { label: "Public USDC", sub: "In your connected wallet" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border bg-white/[.015] p-5"
                  >
                    <p className="text-xs text-text-secondary">{item.label}</p>
                    <p className="my-7 text-3xl font-medium">—</p>
                    <p className="text-[11px] leading-5 text-text-muted">
                      {item.sub}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-[11px] text-text-muted">
                <span>Confidential amounts. Clear next steps.</span>
                <span className="flex items-center gap-2">
                  <LockKeyhole className="h-3 w-3 text-accent" />
                  Addresses and metadata stay public
                </span>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-5 text-center text-[11px] text-text-muted">
          Interface preview. No balances, transactions, or activity are
          simulated.
        </p>
      </section>

      <section className="landing-wrap landing-section border-t border-border">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="landing-kicker mb-5">Built around real work</p>
            <h2 className="landing-heading">
              Less exposure.
              <br />
              More room to move.
            </h2>
          </div>
          <Link
            prefetch={false}
            href="/home"
            className="flex min-h-11 items-center gap-3 text-sm text-accent"
          >
            Find your flow <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {workflows.map(
            ({ icon: Icon, number, title, description, href, label, tag }) => (
              <article key={href} className="feature-tile">
                <div className="mb-10 flex items-center justify-between">
                  <div className="feature-icon">
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <span className="font-mono text-[10px] tracking-wider text-text-muted">
                    {number} / {tag}
                  </span>
                </div>
                <h3 className="text-2xl font-medium tracking-tight">{title}</h3>
                <p className="mt-4 max-w-md text-sm leading-7 text-text-secondary">
                  {description}
                </p>
                <Link
                  prefetch={false}
                  href={href}
                  className="mt-8 inline-flex min-h-10 items-center gap-3 text-xs font-medium text-accent"
                >
                  {label}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </article>
            ),
          )}
        </div>
      </section>

      <section className="landing-wrap landing-section border-t border-border">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="landing-kicker mb-5">
              Privacy, without the fine print
            </p>
            <h2 className="landing-heading">
              Discreet by design.
              <br />
              <span className="text-text-muted">Honest by default.</span>
            </h2>
            <p className="mt-6 max-w-sm text-sm leading-8 text-text-secondary">
              Confidentiality should be understandable. Here’s exactly what this
              Testnet protects—and what it doesn’t.
            </p>
            <Link
              href="/docs"
              className="mt-7 inline-flex min-h-11 items-center gap-3 text-sm text-accent"
            >
              Understand the boundaries <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {[
              {
                number: "01",
                title: "The amount stays confidential.",
                body: "Transfer amounts use commitments and encrypted channels. The designated auditor can decrypt covered amounts.",
              },
              {
                number: "02",
                title: "The chain stays public.",
                body: "Addresses, timing and transaction metadata are visible. Deposit and withdrawal amounts are public.",
              },
              {
                number: "03",
                title: "This is an experimental Testnet.",
                body: "Demo auditor keys are publicly available. Escrow has a depositor-key custody limitation. Contracts and circuits are unaudited; use test funds only.",
              },
            ].map((item) => (
              <div key={item.number} className="flex gap-5 py-6 first:pt-0">
                <span className="pt-1 font-mono text-[10px] text-accent/80">
                  {item.number}
                </span>
                <div>
                  <h3 className="text-base font-medium">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-text-secondary">
                    {item.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-wrap pb-20">
        <div className="feature-tile grid items-center gap-10 sm:p-10 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="landing-kicker mb-5">
              Your first private payment starts here
            </p>
            <h2 className="landing-heading">Make your move.</h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-text-secondary">
              Connect Varial on Testnet. Register once. Deposit matching test
              USDC and merge it into available funds. Then review, approve, and
              send.
            </p>
          </div>
          <div>
            <Link
              prefetch={false}
              href="/home"
              className="hero-cta lucent-button-primary w-full text-black"
            >
              Open the workspace <ArrowUpRight className="h-4 w-4" />
            </Link>
            <p className="mt-4 text-center text-[10px] text-text-muted">
              Open source. Test funds. Real workflows.
            </p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
