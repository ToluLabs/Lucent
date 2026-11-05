import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { MarketingFooter, MarketingNav } from "@/components/layout/MarketingNav";

const TRUST = [
  {
    title: "No off-chain operators",
    desc: "Every proof is generated in your browser and verified natively by Stellar's Protocol 26 host functions. There is no separate privacy infrastructure to trust.",
  },
  {
    title: "No operator keys",
    desc: "No private key exists that could be stolen to decrypt your balances. The encryption is enforced by mathematics, not by a trusted party.",
  },
  {
    title: "No bridge custody",
    desc: "Your USDC stays in Soroban contracts on Stellar. There is no bridge, no wrapped token and no custodian holding your funds.",
  },
];

const AUDIENCE = [
  { title: "Stellar teams", desc: "Pay contributors and vendors without publishing your treasury's payment history to competitors." },
  { title: "DAOs", desc: "Run payroll with per-person confidential salaries. No member can see another's compensation." },
  { title: "Freelancers", desc: "Invoice and get paid in USDC without your client list and rate card becoming public record." },
  { title: "Protocols", desc: "Need confidential escrow in your settlement layer? Integrate PrivateEscrow into your Soroban contracts." },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-text-muted">{children}</p>;
}

export default function AboutPage() {
  return (
    <div className="min-h-dvh bg-void text-text-primary">
      <MarketingNav />

      {/* Hero */}
      <section className="brand-wash border-b border-border px-6 pb-24 pt-24 lg:px-12 lg:pt-32">
        <Eyebrow>About</Eyebrow>
        <h1 className="max-w-5xl font-display font-medium text-[clamp(3rem,7.5vw,7rem)] leading-[0.95] tracking-[-0.02em]">
          Finance has always needed <span className="text-accent">selective privacy.</span>
        </h1>
        <p className="mt-10 max-w-2xl text-lg leading-relaxed text-text-secondary">
          You would not hand your bank statement to a stranger. Yet every payment on a public
          blockchain is permanently visible to anyone who looks. Lucent fixes that without hiding who
          you paid, only how much.
        </p>
      </section>

      {/* Problem / approach */}
      <section className="grid gap-px border-b border-border bg-border md:grid-cols-2">
        {[
          {
            label: "The problem",
            title: "Everything is exposed, or nothing is auditable.",
            body: [
              "Public blockchains expose every transaction to everyone, forever. Salaries, vendor payments and treasury moves are readable by competitors, data harvesters and anyone with a block explorer.",
              "Existing privacy tools such as mixers, shielded pools and opaque coins hide everything. You lose the auditability that makes a blockchain useful, and compliance becomes impossible.",
            ],
          },
          {
            label: "The approach",
            title: "Encrypt the amount. Keep the rest public.",
            body: [
              "Addresses stay visible on-chain. Amounts are held as Pedersen commitments and moved with zero-knowledge proofs. You can verify that wallet A paid wallet B, but not how much.",
              "Payroll goes out without exposing salaries. Escrow settles without revealing the locked sum. Your history never becomes a public business-intelligence dataset.",
            ],
          },
        ].map((c) => (
          <div key={c.label} className="bg-void px-6 py-16 lg:px-12 lg:py-20">
            <Eyebrow>{c.label}</Eyebrow>
            <h2 className="mb-8 max-w-md font-display font-medium text-4xl leading-[1.05] tracking-tight md:text-5xl">{c.title}</h2>
            <div className="flex max-w-lg flex-col gap-4 leading-relaxed text-text-secondary">
              {c.body.map((p) => (
                <p key={p.slice(0, 20)}>{p}</p>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Trust model */}
      <section className="border-b border-border px-6 py-24 lg:px-12">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Eyebrow>Trust model</Eyebrow>
            <h2 className="font-display font-medium text-4xl leading-[1.05] tracking-tight md:text-5xl">Nothing to trust but the math.</h2>
          </div>
          <ol className="lg:col-span-8">
            {TRUST.map((t, i) => (
              <li key={t.title} className="grid gap-3 border-t border-border py-8 first:border-t-0 first:pt-0 md:grid-cols-[3rem_1fr_1.4fr] md:gap-8">
                <span className="font-mono text-xs text-text-muted">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-display text-xl font-semibold tracking-tight">{t.title}</h3>
                <p className="leading-relaxed text-text-secondary">{t.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Audience */}
      <section className="border-b border-border px-6 py-24 lg:px-12">
        <Eyebrow>Who it is for</Eyebrow>
        <div className="mt-8 grid overflow-hidden rounded-2xl border border-border bg-panel shadow-card sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCE.map((a, i) => (
            <div key={a.title} className={`p-8 ${i > 0 ? "border-t border-border sm:border-t-0 sm:border-l" : ""} ${i === 2 ? "sm:max-lg:border-t sm:max-lg:border-l-0" : ""}`}>
              <h3 className="mb-3 font-display font-medium text-3xl tracking-tight">{a.title}</h3>
              <p className="text-sm leading-relaxed text-text-secondary">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Built on */}
      <section className="grid gap-10 px-6 py-24 lg:grid-cols-12 lg:px-12">
        <div className="lg:col-span-4">
          <Eyebrow>Built on</Eyebrow>
          <h2 className="font-display font-medium text-4xl leading-[1.05] tracking-tight md:text-5xl">Soroban and Protocol 26.</h2>
        </div>
        <div className="lg:col-span-6 lg:col-start-6">
          <p className="leading-relaxed text-text-secondary">
            Protocol 26 shipped native ZK host functions that verify UltraHonk proofs on-chain without
            a coprocessor. Lucent builds on OpenZeppelin's confidential-token module, Pedersen
            commitments, Poseidon2 hashing and a Rust contract stack to bring amount-hidden payments
            to Stellar.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Link
              href="/shield"
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-accent-solid px-6 text-[15px] font-semibold text-on-accent transition-colors hover:bg-accent-solid-hover"
            >
              Launch app <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="https://github.com/OpenZeppelin/stellar-contracts"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-1.5 text-[15px] font-medium"
            >
              <span className="border-b border-fg/30 pb-0.5 transition-colors group-hover:border-accent">OpenZeppelin stellar-contracts</span>
              <ArrowUpRight className="h-4 w-4 text-text-muted" />
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
