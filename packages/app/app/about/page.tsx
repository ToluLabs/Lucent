import { PublicShell } from "@/components/layout/PublicShell";
import Link from "next/link";
export default function AboutPage() {
  return (
    <PublicShell>
      <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 md:py-24">
        <p className="eyebrow">About Lucent</p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          Business payments need
          <br />
          <span className="text-accent">selective privacy.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-text-secondary">
          Public payment amounts can expose compensation and commercial
          relationships. Lucent explores confidential USDC transfers on Stellar
          while retaining public participants and explicit verification
          workflows.
        </p>
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {[
            {
              title: "What works today",
              text: "Wallet registration, public deposits and withdrawals, confidential transfers, payroll templates and atomic runs, experimental escrow, auditor decryption and transfer-specific selective disclosure.",
            },
            {
              title: "How amounts are protected",
              text: "Pedersen commitments on Grumpkin, encrypted channels and browser-generated UltraHonk proofs connect local confidential state with Soroban contract verification.",
            },
            {
              title: "Who can observe what",
              text: "Addresses, timing and metadata remain public. Deposits and withdrawals reveal amounts. Authorized auditor keys decrypt covered amounts; the publicly available Testnet demo key offers no exclusive access.",
            },
            {
              title: "What needs further work",
              text: "Audits, stronger escrow custody, durable indexing and recovery, organization management, approvals and scheduling require further engineering. None are represented as production-ready capabilities.",
            },
          ].map((item) => (
            <article key={item.title} className="glass-card p-7">
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-4 text-sm leading-7 text-text-secondary">
                {item.text}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-12 border-t border-border pt-8">
          <h2 className="text-xl font-semibold">
            Built for testing, in the open.
          </h2>
          <p className="my-4 max-w-2xl text-sm leading-7 text-text-secondary">
            Lucent is experimental, unaudited Testnet software. The contracts,
            circuits, frontend and SDK are available for inspection. A proof
            system does not remove trust in implementations, browser security,
            administrators or viewing-key handling.
          </p>
          <div className="flex flex-wrap gap-6 text-sm text-accent">
            <Link href="/docs">Technical documentation →</Link>
            <a
              href="https://github.com/ToluLabs/Lucent"
              target="_blank"
              rel="noreferrer"
            >
              Explore the source ↗
            </a>
            <Link href="/home">Try the Testnet workspace →</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
