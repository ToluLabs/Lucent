import { PublicShell } from "@/components/layout/PublicShell";
import {
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  LockKeyhole,
  ScanLine,
  Send,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
const workflows = [
  {
    icon: Send,
    title: "Pay with discretion",
    description:
      "Send USDC between registered accounts. Transfer amounts are committed and encrypted; participants remain visible.",
    href: "/send",
    label: "Explore payments",
  },
  {
    icon: Briefcase,
    title: "A better way to run payroll",
    description:
      "Prepare on-chain recipient templates, review salaries and execute a confidential, atomic payment batch.",
    href: "/payroll",
    label: "Explore payroll",
  },
  {
    icon: LockKeyhole,
    title: "Agreements with a visible lifecycle",
    description:
      "Create experimental escrow agreements with delivery, release, refund and optional arbitration workflows.",
    href: "/escrow",
    label: "Explore escrow",
  },
  {
    icon: ScanLine,
    title: "Share a fact, selectively",
    description:
      "Request a disclosure, let the holder authorize a transfer-specific proof, and verify it against the chain.",
    href: "/verify",
    label: "Explore verification",
  },
];
export default function LandingPage() {
  return (
    <PublicShell>
      <section className="mx-auto grid max-w-[1280px] items-center gap-14 px-5 py-16 sm:px-8 md:py-24 xl:grid-cols-[1fr_1.05fr]">
        <div>
          <div className="mb-7 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Built on Stellar · Testnet preview
          </div>
          <h1 className="max-w-xl text-[44px] font-semibold leading-[1.06] tracking-[-0.055em] sm:text-6xl xl:text-[72px]">
            Your payments.
            <br />
            Your business.
            <br />
            <span className="text-accent">Less exposed.</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-8 text-text-secondary">
            Confidential USDC payments for business workflows on Stellar. Send
            payments, run payroll and disclose specific transfer amounts—without
            publishing every transfer amount.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/home"
              className="inline-flex min-h-12 items-center gap-3 rounded-lg bg-accent px-5 text-sm font-semibold text-black hover:bg-accent-hover"
            >
              Open Testnet workspace <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex min-h-12 items-center rounded-lg border border-border px-5 text-sm hover:bg-card"
            >
              Read the documentation
            </Link>
          </div>
          <p className="mt-5 text-xs leading-6 text-text-muted">
            Freighter wallet required for payments. Test funds only. Unaudited.
          </p>
        </div>
        <div>
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_24px_80px_rgba(0,0,0,.25)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <span className="text-sm font-semibold">Lucent workspace</span>
              <span className="text-xs text-accent">Stellar Testnet</span>
            </div>
            <div className="p-5 sm:p-7">
              <div className="mb-7 flex justify-between text-xs text-text-secondary">
                <span>Overview</span>
                <span>Wallet disconnected</span>
              </div>
              <h2 className="text-xl font-semibold">
                A clear view of your funds.
              </h2>
              <p className="mb-6 mt-2 text-xs leading-6 text-text-muted">
                Connect your wallet to see real balances and activity.
              </p>
              <div className="rounded-lg border border-accent/20 bg-card p-5">
                <p className="text-sm text-text-secondary">
                  Available confidential balance
                </p>
                <p className="my-5 text-4xl font-semibold tracking-tight">
                  —{" "}
                  <span className="text-base font-normal text-text-muted">
                    USDC
                  </span>
                </p>
                <div className="flex gap-3 text-xs">
                  <Link
                    href="/send"
                    className="rounded-md bg-accent px-4 py-3 font-semibold text-black"
                  >
                    Send payment
                  </Link>
                  <Link
                    href="/shield"
                    className="rounded-md border border-border px-4 py-3"
                  >
                    Add funds
                  </Link>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                {["Incoming · requires merge", "Public wallet balance"].map(
                  (label) => (
                    <div
                      key={label}
                      className="rounded-lg border border-border p-4"
                    >
                      <p className="text-xs leading-5 text-text-secondary">
                        {label}
                      </p>
                      <p className="mt-4 text-2xl">—</p>
                    </div>
                  ),
                )}
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
                <span className="text-xs text-text-secondary">
                  Confidential payments, explicit review.
                </span>
                <ShieldCheck className="h-4 w-4 text-accent" />
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-xs leading-6 text-text-muted">
            Interface preview · no balances or activity are simulated.
          </p>
        </div>
      </section>
      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-[1280px] gap-6 px-5 py-8 sm:px-8 md:grid-cols-3">
          {[
            {
              title: "Amounts, not anonymity",
              text: "Transfer amounts are hidden. Addresses and metadata stay public.",
            },
            {
              title: "Proofs in your browser",
              text: "Local proof generation. Verification by Soroban contracts.",
            },
            {
              title: "Disclosure with context",
              text: "Verify a specific amount against its public transfer event.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="md:border-r md:border-border md:pr-6 last:border-0"
            >
              <h2 className="text-sm font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section
        id="workflows"
        className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8 md:py-24"
      >
        <p className="eyebrow">One connected workspace</p>
        <div className="mt-4 grid gap-7 md:grid-cols-2">
          <h2 className="max-w-lg text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Every payment has a purpose.
            <br />
            Give it a proper workflow.
          </h2>
          <p className="max-w-lg text-base leading-8 text-text-secondary">
            Move from funding to payment, from a recipient template to a payroll
            run, or from a disclosure request to a verified result. Understand
            what happens before you approve.
          </p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {workflows.map(
            ({ icon: Icon, title, description, href, label }, i) => (
              <article
                key={href}
                className="rounded-xl border border-border bg-surface p-6 sm:p-8"
              >
                <div className="mb-8 flex items-center justify-between">
                  <Icon className="h-6 w-6 text-accent" />
                  <span className="font-mono text-xs text-text-muted">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="mb-6 mt-4 max-w-lg text-sm leading-7 text-text-secondary">
                  {description}
                </p>
                <Link
                  href={href}
                  className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-accent"
                >
                  {label}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </article>
            ),
          )}
        </div>
      </section>
      <section className="border-y border-border bg-[#ece9df] text-[#20242a]">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#5c5546]">
              Privacy, precisely explained
            </p>
            <h2 className="mt-4 max-w-lg text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Confidence starts with knowing the boundaries.
            </h2>
            <Link
              href="/docs"
              className="mt-7 inline-flex min-h-11 items-center gap-3 rounded-lg border border-[#777367] px-5 text-sm font-semibold"
            >
              Read how Lucent works <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <dl className="divide-y divide-[#c6c2b7] text-sm">
            {[
              {
                title: "Confidential transfers",
                text: "Commitments and encrypted channels hide transfer amounts. The designated auditor can decrypt covered amounts.",
              },
              {
                title: "Observable on-chain",
                text: "Participants, timing and metadata stay public. Deposit and withdrawal amounts are public too.",
              },
              {
                title: "An experimental Testnet",
                text: "Demo auditor keys are public. Escrow retains a depositor-key custody limitation. Contracts and circuits are unaudited; do not use real funds.",
              },
            ].map((item) => (
              <div key={item.title} className="py-5 first:pt-0">
                <dt className="font-semibold">{item.title}</dt>
                <dd className="mt-2 leading-7 text-[#4d525a]">{item.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
      <section className="mx-auto max-w-[1280px] px-5 py-20 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <p className="eyebrow">From your wallet to a payment</p>
            <h2 className="mt-4 max-w-lg text-3xl font-semibold tracking-tight">
              Try the full flow.
              <br />
              See what happens at each step.
            </h2>
          </div>
          <ol className="space-y-6">
            {[
              {
                title: "Connect and register",
                text: "Use Freighter on Stellar Testnet. A one-time proof binds your confidential keys.",
              },
              {
                title: "Fund and merge",
                text: "Deposit matching Testnet USDC, then merge incoming funds to make them available.",
              },
              {
                title: "Review, approve and confirm",
                text: "Check the recipient and amount. Generate a proof locally, approve in your wallet and wait for confirmation.",
              },
            ].map((item, i) => (
              <li key={item.title} className="flex gap-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border font-mono text-xs text-accent">
                  0{i + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-text-secondary">
                    {item.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-14 flex flex-wrap items-center justify-between gap-6 rounded-xl border border-border bg-surface p-6 sm:p-8">
          <div>
            <h2 className="text-xl font-semibold">
              Built in the open. Ready to test.
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Explore the implementation and help shape confidential payments on
              Stellar.
            </p>
          </div>
          <Link
            href="/home"
            className="inline-flex min-h-12 items-center gap-3 rounded-lg bg-accent px-5 text-sm font-semibold text-black"
          >
            Try Lucent on Testnet <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
