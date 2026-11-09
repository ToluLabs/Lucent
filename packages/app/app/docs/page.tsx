"use client";
import { PublicShell } from "@/components/layout/PublicShell";
import { Modal } from "@/components/ui/Modal";
import { Callout } from "@/components/ui/Callout";
import { DEPLOYMENT } from "@/lib/deployment";
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Code2,
  Layers3,
  List,
  Search,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
const GROUPS = [
  {
    label: "Start here",
    items: [
      { id: "introduction", label: "Overview" },
      { id: "getting-started", label: "First Testnet payment" },
      { id: "how-it-works", label: "Architecture & balances" },
    ],
  },
  {
    label: "Product workflows",
    items: [
      { id: "deposit-withdraw", label: "Funding & withdrawals" },
      { id: "private-payments", label: "Confidential payments" },
      { id: "payroll", label: "Payroll" },
      { id: "escrow", label: "Escrow" },
      { id: "disclosure", label: "Selective disclosure" },
    ],
  },
  {
    label: "Developers",
    items: [
      { id: "developer-guide", label: "Local setup & testing" },
      { id: "sdk", label: "SDK integration" },
      { id: "contracts", label: "Deployed contracts" },
    ],
  },
  {
    label: "Security & operations",
    items: [
      { id: "auditor", label: "Auditor access" },
      { id: "compliance", label: "Authorization & policy" },
      { id: "recovery", label: "History & recovery" },
      { id: "faq", label: "FAQ" },
    ],
  },
];
const SECTIONS = GROUPS.flatMap((group) => group.items);
const SDK_ACCOUNT_EXAMPLE = `import { ChainClient } from "@lucent/sdk";
import { DEPLOYMENT } from "@/lib/deployment";

const client = new ChainClient({
  rpcUrl: DEPLOYMENT.rpcUrl,
  networkPassphrase: DEPLOYMENT.networkPassphrase,
  contracts: DEPLOYMENT.contracts,
});

export async function isRegistered(address: string): Promise<boolean> {
  const account = await client.confidentialBalance(address);
  return account !== null;
}`;
function Code({ children }: { children: string }) {
  return <code className="docs-inline-code">{children}</code>;
}
function Pre({ children }: { children: string }) {
  return (
    <div className="docs-code">
      <div className="docs-code-header">
        <span>Reference</span>
        <Code2 className="h-3.5 w-3.5" />
      </div>
      <pre tabIndex={0} aria-label="Code example">
        {children}
      </pre>
    </div>
  );
}
function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="docs-h2">
      <a href={`#${id}`}>
        {children}
        <span aria-hidden="true">#</span>
      </a>
    </h2>
  );
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="docs-h3">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="docs-paragraph">{children}</p>;
}
function AddressRow({ name, addr }: { name: string; addr: string }) {
  return (
    <div className="docs-address-row">
      <span>{name}</span>
      {addr ? (
        <a
          href={`https://stellar.expert/explorer/testnet/contract/${addr}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono"
        >
          {addr}
          <ArrowUpRight className="ml-2 inline h-3 w-3" />
        </a>
      ) : (
        <span className="text-text-muted">Not configured</span>
      )}
    </div>
  );
}
export default function DocsPage() {
  const [activeId, setActiveId] = useState("introduction");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const headings = Array.from(
      document.querySelectorAll<HTMLElement>(".docs-h2"),
    );
    let scheduled = false;
    const update = () => {
      scheduled = false;
      let current = headings[0]?.id;
      for (const h of headings) {
        if (h.getBoundingClientRect().top <= 120) current = h.id;
        else break;
      }
      if (current) setActiveId(current);
    };
    const onScroll = () => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  const addresses = {
    ConfidentialToken: DEPLOYMENT.contracts.token,
    Verifier: DEPLOYMENT.contracts.verifier,
    Auditor: DEPLOYMENT.contracts.auditor,
    PayrollVault: DEPLOYMENT.contracts.payroll,
    "PrivateEscrow Factory": DEPLOYMENT.contracts.escrowFactory,
    "Compliance Policy": DEPLOYMENT.contracts.policy,
  };
  function navigation(mobile = false) {
    return (
      <>
        <label className="docs-search">
          <Search className="h-4 w-4" />
          <span className="sr-only">Find a documentation topic</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a topic…"
            type="search"
          />
        </label>
        <nav
          aria-label={
            mobile ? "Mobile documentation topics" : "Documentation topics"
          }
        >
          {GROUPS.map((group) => {
            const items = group.items.filter((item) =>
              `${group.label} ${item.label}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            );
            return items.length ? (
              <div className="docs-nav-group" key={group.label}>
                <p>{group.label}</p>
                {items.map(({ id, label }) => (
                  <a
                    href={`#${id}`}
                    key={id}
                    aria-current={activeId === id ? "location" : undefined}
                    onClick={() => {
                      setActiveId(id);
                      setSidebarOpen(false);
                    }}
                  >
                    <span />
                    {label}
                  </a>
                ))}
              </div>
            ) : null;
          })}
          {query &&
            !SECTIONS.some((item) =>
              item.label.toLowerCase().includes(query.toLowerCase()),
            ) &&
            !GROUPS.some((group) =>
              group.label.toLowerCase().includes(query.toLowerCase()),
            ) && (
              <p className="py-4 text-sm text-text-muted" role="status">
                No matching topics.
              </p>
            )}
        </nav>
      </>
    );
  }
  return (
    <PublicShell wide>
      <div className="docs-shell">
        <aside className="docs-sidebar">
          <Link href="/docs" className="docs-library-title">
            <BookOpen className="h-4 w-4 text-accent" />
            Documentation
          </Link>
          {navigation()}
          <a
            href="https://github.com/ToluLabs/Lucent"
            target="_blank"
            rel="noreferrer"
            className="docs-source-link"
          >
            View source on GitHub <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </aside>
        <article className="docs-content">
          <div className="docs-breadcrumb">
            <span>Lucent</span>
            <ChevronRight className="h-3 w-3" />
            <span>Documentation</span>
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="docs-mobile-trigger"
            >
              <List className="h-4 w-4" />
              Topics
            </button>
          </div>
          <header className="docs-intro">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="landing-kicker">Understand. Build. Verify.</p>
              <span className="docs-network">
                <span className="status-spark" />
                Stellar Testnet
              </span>
            </div>
            <h1>Build with Lucent.</h1>
            <p>
              From your first confidential payment to integrating the protocol.
              Explore the workflows, architecture, and privacy boundaries in one
              place.
            </p>
          </header>
          <div className="docs-entry-grid">
            {[
              {
                href: "#getting-started",
                icon: Layers3,
                title: "Start with a payment",
                text: "Connect, register and send on Testnet.",
              },
              {
                href: "#developer-guide",
                icon: Code2,
                title: "Build an integration",
                text: "Local setup, SDK patterns and checks.",
              },
              {
                href: "#recovery",
                icon: ShieldCheck,
                title: "Know the boundaries",
                text: "Privacy, viewing keys and recovery.",
              },
            ].map(({ href, icon: Icon, title, text }) => (
              <a key={href} href={href}>
                <Icon className="h-5 w-5 text-accent" />
                <h2>
                  {title}
                  <ArrowUpRight className="h-4 w-4" />
                </h2>
                <p>{text}</p>
              </a>
            ))}
          </div>
          <section className="docs-section" aria-labelledby="introduction">
            <H2 id="introduction">What Lucent does</H2>
            <P>
              Lucent is an experimental confidential payments layer on Stellar
              Testnet. It supports registered-account USDC transfers, payroll
              templates and atomic runs, experimental escrow, auditor viewing
              and transfer-specific selective disclosure.
            </P>
            <div className="docs-fact-grid">
              <div>
                <span className="docs-small-label">Confidential</span>
                <h3>Transfer amounts &amp; balance commitments</h3>
                <p>
                  Amounts are committed and encrypted. Account holders and the
                  relevant auditor keys can reveal covered data.
                </p>
              </div>
              <div>
                <span className="docs-small-label">Public</span>
                <h3>Participants &amp; network metadata</h3>
                <p>
                  Addresses, timing, deposits and withdrawal amounts remain
                  visible. Confidential transfers do not provide anonymity.
                </p>
              </div>
              <div>
                <span className="docs-small-label">Experimental</span>
                <h3>Testnet, with explicit trust assumptions</h3>
                <p>
                  Circuits and contracts are unaudited. Demo auditor keys are
                  public, and escrow has a depositor-key custody limitation.
                </p>
              </div>
            </div>
            <P>
              Spendable and receiving balances are represented with Pedersen
              commitments on the Grumpkin curve, <Code>C = v·G + r·H</Code>.
              Browser-generated proofs establish the required arithmetic without
              publishing confidential transfer amounts. Security still depends
              on the implementation, wallet, browser, retained local state,
              administrator permissions and auditor-key handling.
            </P>
          </section>
          <section className="docs-section" aria-labelledby="getting-started">
            <H2 id="getting-started">Your first Testnet payment</H2>
            <P>
              Use a test wallet and test assets. Existing deployments can be
              used without redeploying the contracts. Registration and balances
              are specific to the configured network and token deployment.
            </P>
            <ol className="docs-step-grid">
              {[
                {
                  title: "Connect",
                  text: "Install and unlock Freighter, select Stellar Testnet, then connect from Overview. Fund Testnet XLM for transaction fees.",
                },
                {
                  title: "Register",
                  text: "Complete the one-time confidential-account registration. A local proof binds your derived keys to the on-chain account.",
                },
                {
                  title: "Fund & merge",
                  text: "Deposit USDC matching this deployment’s underlying asset. Deposits enter receiving; merge them into available funds before spending.",
                },
                {
                  title: "Review & send",
                  text: "Use Payments to check a registered recipient, enter an amount, review, generate the proof and approve in Freighter. Wait for confirmation.",
                },
              ].map((step, i) => (
                <li key={step.title}>
                  <span className="docs-step-number">0{i + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="docs-inline-links">
              <Link href="/home">
                Open Overview <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/shield">
                Add test funds <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/send">
                Make a payment <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <Callout>
              Friendbot provides Testnet XLM, not USDC. An asset with a
              different issuer cannot fund this deployment. Keep this browser’s
              confidential state; do not clear storage as a routine recovery
              step.
            </Callout>
          </section>
          <section className="docs-section" aria-labelledby="how-it-works">
            <H2 id="how-it-works">How it Works</H2>
            <p className="docs-small-label">A proof-carrying operation</p>
            <ol className="docs-flow">
              {[
                {
                  title: "Your browser",
                  text: "Reads account state and builds the witness.",
                },
                {
                  title: "Local proof",
                  text: "Proves the required operation constraints.",
                },
                {
                  title: "Freighter",
                  text: "Authorizes the transaction on Testnet.",
                },
                {
                  title: "Soroban",
                  text: "Verifies the proof and applies contract rules.",
                },
                {
                  title: "Confirmation",
                  text: "The wallet waits for a network result.",
                },
              ].map((step, i) => (
                <li key={step.title}>
                  <span>0{i + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
            <P>
              Every confidential account holds a <strong>spendable</strong>{" "}
              balance (what you can send or withdraw) and a{" "}
              <strong>receiving</strong> balance (where deposits and incoming
              transfers land). A <Code>merge</Code> folds receiving into
              spendable — a homomorphic point addition that needs no proof.
            </P>
            <Pre>{`register    proof  Bind your Grumpkin keys to the contract (one-time)
deposit     —      Public USDC -> your receiving balance
merge       —      Fold receiving -> spendable
withdraw    proof  Spendable -> public USDC
transfer    proof  Spendable -> another account's receiving balance`}</Pre>
            <P>
              Every transfer also emits dual auditor ciphertexts — one for the
              sender&apos;s channel, one for the recipient&apos;s — so the
              registered auditor key can decrypt every amount without either
              party&apos;s cooperation.
            </P>
          </section>
          <section className="docs-section" aria-labelledby="deposit-withdraw">
            <H2 id="deposit-withdraw">Deposit & Withdraw</H2>
            <div className="docs-topics">
              <div className="docs-topic">
                <H3>Register (one-time)</H3>
                <P>
                  Before any of this, <strong>Overview</strong> derives a
                  Grumpkin key set deterministically from a Freighter message
                  signature — the same keys every session, while local
                  confidential state still needs to be preserved — and proves
                  ownership of it with a zero-knowledge proof that binds the key
                  set to your Stellar address on the token contract. This
                  happens once per account; every confidential operation below
                  depends on it having already happened.
                </P>
              </div>
              <div className="docs-topic">
                <H3>Deposit</H3>
                <P>
                  Go to <strong>Funding</strong> and deposit. This moves public
                  USDC into your confidential receiving balance at a 1:1 ratio —
                  no proof required, since the deposit commitment has zero
                  blinding. The deposit amount is a public plaintext{" "}
                  <Code>i128</Code> in USDC base units (7 decimals, so 1 USDC =
                  10,000,000 base units). Merge it into spendable before sending
                  or withdrawing.
                </P>
                <P>
                  Spendable and receiving are shown as two separate numbers
                  deliberately: a deposit (or an incoming transfer) counts as
                  yours the moment it lands, but it isn&apos;t spendable or
                  withdrawable until you merge it in.
                </P>
              </div>
              <div className="docs-topic">
                <H3>Withdraw</H3>
                <P>
                  Withdrawing is a two-step, in-browser flow: a withdraw proof
                  is generated locally (this takes a device-dependent amount of
                  time — you&apos;re proving &quot;I can open this commitment to
                  a value at most my balance&quot; without revealing the balance
                  itself), then submitted on-chain. The Soroban verifier checks
                  the proof and converts your spendable balance back into public
                  USDC.
                </P>
              </div>
            </div>
          </section>
          <section className="docs-section" aria-labelledby="private-payments">
            <H2 id="private-payments">Private Payments</H2>
            <P>
              Go to <strong>Payments</strong>, enter a recipient address, and
              enter an amount. A transfer proof is generated in your browser and
              submitted with the transaction — the recipient address is visible
              on-chain; the amount is not.
            </P>
            <H3>Why only registered recipients</H3>
            <P>
              Building the transfer proof requires the recipient&apos;s public
              viewing key (<Code>PVK</Code>), which only exists on-chain once
              they&apos;ve completed the one-time register step themselves. The
              form checks the entered address before review. An unregistered
              recipient blocks progress; a failed network check is shown as
              unavailable rather than treated as unregistered. The wallet checks
              again before building the transfer.
            </P>
            <H3>What the proof actually proves</H3>
            <P>
              <Code>confidential_transfer</Code> proves, without revealing any
              of the three numbers involved: &quot;I know the opening of my
              spendable commitment, it covers at least this amount, and here are
              two new commitments — one for what I&apos;m sending and one for
              what stays in my own balance.&quot; The proof also seals the
              amount into two ciphertexts, one per auditor channel
              (sender&apos;s and recipient&apos;s), so a registered auditor can
              decrypt it later even though no one else can.
            </P>
            <P>
              The sent amount lands in the recipient&apos;s receiving balance,
              not spendable — same as a deposit, they merge it in whenever they
              like.
            </P>
          </section>
          <section className="docs-section" aria-labelledby="payroll">
            <H2 id="payroll">Confidential Payroll</H2>
            <P>
              <strong>PayrollVault</strong> is an orchestrator, not a custodian:
              an employer creates a template of employees and opens a run.
              Plaintext salaries are not stored in contract state — at execution
              the employer&apos;s browser proves one confidential transfer per
              employee, and the vault routes them atomically. The vault does not
              store plaintext salaries. Employees who also hold a relevant
              auditor key can decrypt covered amounts; the public demo key means
              Testnet salaries are not exclusively private.
            </P>
            <Pre>{`create_template(employer, employees) -> template_id
create_run(template_id)               -> run_id
fund_run(run_id)
execute_run(run_id, transfers)        // one proof per employee
cancel_run(run_id)
claim()                               // employee folds salary into spendable`}</Pre>
            <div className="docs-topics">
              <div className="docs-topic">
                <H3>Employer flow</H3>
                <P>
                  <strong>Create a template</strong> once with the employee list
                  — templates carry no amounts, just who gets paid.{" "}
                  <strong>Create a run</strong> against it to open a{" "}
                  <Code>Scheduled</Code> run. <strong>Confirm the run</strong> (
                  <Code>fund_run</Code> on-chain — the app calls it "Confirm"
                  since it doesn't actually move anything) records readiness,
                  without checking or reserving the eventual salary total — a
                  state marker, not a transfer. The execution proof enforces the
                  actual spending constraints.
                </P>
                <P>
                  <strong>Execute the run</strong> is where the money actually
                  moves: the employer enters each salary, and the browser builds
                  one transfer proof per employee, chained — employee 2&apos;s
                  proof spends the balance opening left over after employee
                  1&apos;s, and so on, so the whole batch is internally
                  consistent. All proofs submit in one transaction; the vault
                  runs every transfer and only marks the run{" "}
                  <Code>Executed</Code> if all of them succeed — no partial
                  payroll runs. Only a <Code>Scheduled</Code> (draft) run can be
                  cancelled through the current contract flow; this does not
                  execute salaries.
                </P>
              </div>
              <div className="docs-topic">
                <H3>Employee flow</H3>
                <P>
                  A paid employee sees the salary appear in their receiving
                  balance and merges it into spendable with{" "}
                  <strong>Merge incoming funds</strong>, the same{" "}
                  <Code>merge</Code> as anywhere else — no proof needed.
                </P>
              </div>
              <div className="docs-topic">
                <H3>Compliance</H3>
                <P>
                  Every salary transfer is an ordinary{" "}
                  <Code>confidential_transfer</Code>, so it carries the same
                  dual auditor ciphertexts as a Send. An auditor viewing key
                  gives standing access to amounts covered by that key, not just
                  one employee or run. Reconstructed history depends on
                  available events. Public Testnet demo keys do not provide
                  exclusive employer or employee access.
                </P>
              </div>
            </div>
          </section>
          <section className="docs-section" aria-labelledby="escrow">
            <H2 id="escrow">Encrypted Escrow</H2>
            <P>
              <strong>PrivateEscrow</strong> is custodial, unlike Payroll: the
              funds actually need to sit somewhere confidential between funding
              and release, and each agreement needs a separate confidential
              account, so each escrow deploys its own instance contract to hold
              it — its own confidential account, isolated from every other
              escrow&apos;s.
            </P>
            <Pre>{`Depositor creates -> funds escrow      (CREATED -> FUNDED)
Recipient delivers -> mark_completed   (FUNDED -> COMPLETED)
Depositor reviews -> release           (COMPLETED -> RELEASED)

If depositor stalls past the release window:
  With arbiter    -> recipient disputes    (DISPUTED, arbiter resolves)
  Without arbiter -> recipient claims      (auto RELEASED)

No delivery -> depositor waits for timeout -> reclaims (REFUNDED)`}</Pre>
            <div className="docs-topics">
              <div className="docs-topic">
                <H3>The two clocks</H3>
                <P>
                  Two independent, non-overlapping timers gate the escrow — one
                  per failure mode:
                </P>
                <P>
                  <strong>Timeout</strong> protects the depositor if the
                  recipient never engages at all. Chosen per-escrow at creation
                  — <Code>1h</Code>, <Code>24h</Code>, <Code>7d</Code>, or{" "}
                  <Code>30d</Code> — and only live while still{" "}
                  <Code>Funded</Code>: once the recipient marks delivery, the
                  timeout path is permanently blocked, so a stale timeout can
                  never undercut a delivery that&apos;s already been confirmed.
                </P>
                <P>
                  <strong>Release window</strong> protects the recipient if the
                  depositor stalls after delivery is confirmed. Fixed at{" "}
                  <Code>10 minutes</Code> from <Code>mark_completed</Code>, not
                  configurable per-escrow. Both deadlines are enforced by the
                  contract itself, not the app — calling an action before its
                  deadline simply reverts on-chain. The Escrow screen shows a
                  live countdown to whichever deadline currently applies, and
                  disables the corresponding action (Timeout Refund / Claim /
                  Dispute) until it actually opens, so there&apos;s no guessing
                  at when a call will succeed.
                </P>
              </div>
              <div className="docs-topic">
                <H3>Funding and payout validation</H3>
                <P>
                  Funding is the expensive step, proof-wise — the depositor
                  derives a one-time Grumpkin identity for the instance itself
                  and builds four proofs: a register proof for that identity, a
                  transfer-in proof (depositor → instance), and — because the
                  instance can never generate a proof on its own later — both
                  possible payout proofs up front, instance → recipient and
                  instance → depositor. At roughly 14KB each, all four together
                  exceed what fits in one Soroban transaction. Four wallet
                  confirmations prepare the inputs, verify each payout, and
                  fund:
                </P>
                <Pre>{`prepare_funding(register_data, auditor_id, transfer_in)
store_payout_proof(true, release_proof)    // verifies recipient payout
store_payout_proof(false, refund_proof)    // verifies depositor refund
fund()                                   // atomically registers, transfers and merges`}</Pre>
                <P>
                  <Code>fund</Code> requires both payout proofs to have passed
                  verification against the exact prepared funding commitment.
                  Replacing the funding inputs clears both approvals. Funds move
                  only in the last call; a rejected proof leaves the escrow
                  unfunded. The depositor is expected to discard the
                  instance&apos;s one-time secret; the interface cannot enforce
                  that — see the trust caveat below.
                </P>
              </div>
              <div className="docs-topic">
                <H3>Settlement</H3>
                <P>
                  Every payout proof was generated once, at funding time,
                  against a fixed opening. That&apos;s what lets the instance
                  submit one of them unattended, whenever the state machine says
                  so. Funding merges once, atomically; settlement never merges
                  later deposits, so unsolicited credits cannot change that
                  fixed opening. No one needs to be online or hold a key at
                  settlement time. On the happy path the recipient marks
                  delivery, a 10-minute release window opens, and the depositor
                  releases. If the depositor stalls, the recipient either
                  self-serves after the window (no arbiter) or escalates to a
                  dispute (arbiter configured) — the arbiter role resolves by
                  state transition alone. That role does not itself reveal the
                  amount; an arbiter with the relevant auditor key can still
                  decrypt it.
                </P>
              </div>
              <div className="docs-topic">
                <H3>Trust caveat</H3>
                <Callout>
                  To pre-generate the two payout proofs, the depositor must
                  derive the instance&apos;s Grumpkin secret at fund time.
                  They&apos;re expected to discard it immediately afterward — a
                  depositor who keeps it could re-spend the escrowed balance and
                  invalidate both stored proofs. Acceptable for a testnet demo;
                  not a production-grade custody model.
                </Callout>
              </div>
            </div>
          </section>
          <section className="docs-section" aria-labelledby="disclosure">
            <H2 id="disclosure">Selective Disclosure</H2>
            <P>
              The Auditor screen gives one party standing access to everything
              under an auditor id — the right tool for a compliance
              relationship, wrong for a one-off. Selective disclosure answers a
              narrower need: proving <em>one specific payment</em> to someone
              who shouldn&apos;t get a decrypt key to your whole history — an
              accountant who needs one receipt, a landlord who wants proof of
              one rent payment. It&apos;s a proof, generated and verified
              entirely off-chain — there&apos;s no on-chain disclosure verifier,
              the chain is only ever read from, never written to, for this flow.
            </P>
            <div className="docs-topics">
              <div className="docs-topic">
                <H3>Two claims</H3>
                <P>
                  <strong>D-recipient</strong> — &quot;this on-chain transfer
                  paid me exactly this amount.&quot; Available for anything you
                  received; you can already decrypt it with your own viewing
                  key.
                </P>
                <P>
                  <strong>D-sender</strong> — &quot;I sent this on-chain
                  transfer for exactly this amount.&quot; This one needs more:
                  you re-derive the one-time ephemeral scalar your wallet used
                  at send time from data still on the event itself, then prove
                  you can reconstruct what the recipient decrypted. If that
                  scalar isn&apos;t recoverable (old local state, a different
                  device), the transfer isn&apos;t disclosable as a sender —
                  your Overview activity feed marks it accordingly.
                </P>
              </div>
              <div className="docs-topic">
                <H3>How it works</H3>
                <P>
                  On the <strong>Verify</strong> screen (no wallet required —
                  this can be anyone, even someone with no Stellar account at
                  all), click &quot;Create request&quot;: a fresh public key and
                  nonce, generated locally, that binds whatever proof comes back
                  to this request specifically so it can&apos;t be replayed
                  against someone else. Copy the resulting JSON and send it to
                  the holder however you&apos;d normally share a file.
                </P>
                <P>
                  The holder pastes that JSON against the relevant transfer
                  right in their <strong>Overview</strong> activity feed — a
                  &quot;Disclose&quot; action sits next to any transfer
                  that&apos;s disclosable. The browser generates a
                  zero-knowledge proof bound to it — device-dependent in-browser
                  proving — and produces a bundle to copy back. Paste the bundle
                  into the Verify screen to check it.
                </P>
              </div>
              <div className="docs-topic">
                <H3>Why the verifier doesn&apos;t have to trust the bundle</H3>
                <P>
                  The verifier never takes the holder&apos;s word for anything
                  except the proof and one sealed ciphertext. It doesn&apos;t
                  trust the bundle for who sent the transfer, who received it,
                  or what the transaction even was — it re-reads the actual
                  event from the chain by the bundle&apos;s event reference,
                  re-reads the relevant account&apos;s public viewing key from
                  the token contract, and re-derives every other public input
                  from that independently-fetched chain state. Only then does it
                  check the proof, and only after the proof checks out does it
                  decrypt the sealed amount with the verifier&apos;s own secret
                  key — never the holder&apos;s. The circuit&apos;s range and
                  binding constraints mean a holder can&apos;t get a false
                  amount past the proof by construction.
                </P>
              </div>
            </div>
          </section>
          <section className="docs-section" aria-labelledby="auditor">
            <H2 id="auditor">Auditor View Key</H2>
            <P>
              Every account registers under an auditor id. The holder of that
              Grumpkin secret key can decrypt every transfer amount and balance
              checkpoint on the <strong>Auditor</strong> screen — the
              institutional compliance primitive. The screen needs no wallet.
              Keys are processed locally. Optional remembering stores a viewing
              key unencrypted in this browser; avoid it on shared devices. The
              public demo key means Testnet auditor access is not exclusive.
            </P>
            <P>
              Once unlocked, the console fetches every transfer/withdraw event
              under that auditor id, decrypts each one, and replays the stream
              into a running per-account view: spendable balance from the
              sender-channel checkpoints, receiving balance as the sum of
              decrypted inbound transfers plus public deposits, folded on merge.
            </P>
            <H3>Public demo access</H3>
            <P>
              The Testnet demo viewing key has been publicly distributed. It
              offers no exclusive auditor access. Use only test data and test
              funds. This page does not embed private keys; obtain a test
              viewing key through your deployment operator.
            </P>
          </section>
          <section className="docs-section" aria-labelledby="compliance">
            <H2 id="compliance">Compliance Policy</H2>
            <P>
              Beyond the auditor&apos;s standing visibility into amounts, the
              token contract carries two independent, on-chain-enforced
              compliance primitives: an <strong>allowlist policy</strong> and
              per-account <strong>freezing</strong>. Both are gated behind a
              single compliance admin address set at deploy time — nobody else
              can call either, and the contract enforces that itself rather than
              relying on the app to hide the buttons.
            </P>
            <P>
              <strong>Allowlist.</strong> A separate policy contract holds a
              simple allow/deny registry. When wired onto the token, every
              deposit, transfer, receive, and withdraw checks the policy first —
              an account not on the list is rejected on-chain, before any amount
              is touched. The registry records address permissions; it does not
              perform identity verification or KYC. Any identity checks,
              onboarding decisions and ongoing reviews must happen outside this
              contract before the administrator updates the list.
            </P>
            <P>
              <strong>Freezing.</strong> Independent of the allowlist, the
              compliance admin can freeze a specific account outright — it can
              no longer deposit, transfer, receive, or withdraw until unfrozen,
              regardless of allowlist status. Useful for responding to a flagged
              account without having to touch the broader allowlist.
            </P>
            <P>
              Both are managed from the <strong>Auditor</strong> screen&apos;s
              Compliance panel: connect the compliance-admin&apos;s wallet,
              paste an address, and allow/remove or freeze/unfreeze it. The
              panel also shows the live allowlist/frozen status for any address
              you check.
            </P>
            {!DEPLOYMENT.contracts.policy && (
              <Callout tone="warning">
                In the default deployment, the deployer wallet serves as both
                the auditor key registrant and the compliance admin. These roles
                can be separated by passing different addresses to the deploy
                script.
              </Callout>
            )}
          </section>
          <section className="docs-section" aria-labelledby="developer-guide">
            <H2 id="developer-guide">Run Lucent locally</H2>
            <P>
              The repository is a pnpm workspace with a Next.js app, a
              TypeScript SDK, Noir disclosure artifacts and Rust/Soroban
              contracts. Use Node 20 or newer and pnpm 10. Contract work
              additionally requires the pinned Rust toolchain, the{" "}
              <Code>wasm32v1-none</Code> target and Stellar CLI.
            </P>
            <div className="docs-two-up">
              <div>
                <H3>Install and start</H3>
                <Pre>{`git clone https://github.com/ToluLabs/Lucent.git
cd Lucent
pnpm install --frozen-lockfile
pnpm dev`}</Pre>
                <P>
                  The app runs at <Code>http://localhost:3000</Code>. The app’s
                  predev script builds the SDK and vendors its browser proof
                  backend before starting Next.js. The existing
                  cross-origin-isolation headers are required for the proof
                  backend; preserve them in hosting configurations.
                </P>
              </div>
              <div>
                <H3>Build and check</H3>
                <Pre>{`pnpm build:sdk
pnpm --filter @lucent/sdk typecheck
pnpm --filter @lucent/app typecheck
pnpm test:forms
pnpm test:analytics
pnpm --filter @lucent/sdk test:fast
pnpm --filter @lucent/app build`}</Pre>
                <P>
                  Run <Code>cargo test</Code> from <Code>contracts/</Code> for
                  the contract suite. The fast SDK suite does not replace live
                  proving or live network tests.
                </P>
              </div>
            </div>
            <H3>Browser and transaction-flow checks</H3>
            <Pre>{`pnpm --filter @lucent/app exec playwright-core install chromium
pnpm test:ui
pnpm --filter @lucent/app test:browser`}</Pre>
            <P>
              Run the app build first. The UI suite uses isolated wallet/event
              fixtures and synthetic balances; it does not sign live
              transactions. The production browser suite starts a local
              production server and checks routes, widths and accessibility.
              Linux may require{" "}
              <Code>playwright-core install --with-deps chromium</Code>;
              alternatively set <Code>CHROME_PATH</Code> to an installed Chrome
              executable.
            </P>
            <H3>Deploying contracts is a separate operation</H3>
            <P>
              Use the existing deployment when testing the interface. For a new
              stack, review the repository deployment instructions before
              running <Code>pnpm build:contracts</Code> and{" "}
              <Code>pnpm deploy:contracts</Code>. Deployment requires an
              appropriately funded Stellar CLI identity and underlying asset
              configuration. Rebuild the app after changing the public
              deployment configuration. Keep signing secrets and auditor secrets
              out of public environment variables and client bundles.
            </P>
          </section>
          <section className="docs-section" aria-labelledby="sdk">
            <H2 id="sdk">Integrate with the SDK</H2>
            <P>
              The SDK separates cryptography, witness construction, proving,
              chain calls, state reconstruction, auditor decryption and
              disclosure. Build the workspace SDK before importing{" "}
              <Code>@lucent/sdk</Code>. Start with a read-only account check;
              registration does not require a signing secret to inspect.
            </P>
            <div className="docs-two-up">
              <Pre>{SDK_ACCOUNT_EXAMPLE}</Pre>
              <div>
                <H3>Registration is a read, not a signature</H3>
                <P>
                  This example belongs in the existing app workspace:{" "}
                  <Code>DEPLOYMENT</Code> supplies the public network and
                  contract configuration, and the caller provides the address.
                  External integrations should provide their own checked{" "}
                  <Code>ChainConfig</Code>.
                </P>
                <P>
                  The method returns an on-chain account or <Code>null</Code>.
                  Its balances are commitments, not plaintext amounts. A failed
                  RPC request throws; do not convert that exception into “not
                  registered” or a zero balance.
                </P>
                <P>
                  Use the same network and token deployment as the wallet.
                  Registration on another deployment does not make a recipient
                  ready here.
                </P>
              </div>
            </div>
            <div className="docs-fact-grid">
              <div>
                <span className="docs-small-label">Chain client</span>
                <h3>Read and invoke</h3>
                <p>
                  ChainClient reads account data, simulates calls and submits
                  signed transactions. Use the deployment’s network and contract
                  IDs together.
                </p>
              </div>
              <div>
                <span className="docs-small-label">State engine</span>
                <h3>Preserve local state</h3>
                <p>
                  Confidential openings and history reconstruction are part of
                  the wallet model. Registration alone does not recover every
                  historical balance or disclosure opening.
                </p>
              </div>
              <div>
                <span className="docs-small-label">Proof backend</span>
                <h3>Browser integration</h3>
                <p>
                  The app uses a vendored browser backend with native ESM
                  workers. Follow the existing loader and isolation headers
                  rather than bundling a second prover.
                </p>
              </div>
            </div>
            <P>
              For writable integrations, inspect the existing wallet adapter and
              SDK submit helpers. Constructing the proof, retaining its
              openings, signing authorization and reconciling confirmation are
              distinct responsibilities. Do not treat successful submission as
              final settlement.
            </P>
            <div className="docs-inline-links">
              <a
                href="https://github.com/ToluLabs/Lucent/tree/main/packages/sdk/src"
                target="_blank"
                rel="noreferrer"
              >
                SDK source <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://github.com/ToluLabs/Lucent/blob/main/packages/app/lib/wallet.ts"
                target="_blank"
                rel="noreferrer"
              >
                Wallet integration <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </section>
          <section className="docs-section" aria-labelledby="recovery">
            <H2 id="recovery">History, confirmation &amp; recovery</H2>
            <P>
              History is a data-availability boundary. The app fetches recent
              RPC events and can use a configured indexer for older events. The
              RPC retention window is typically about seven days. An indexer URL
              alone does not prove complete coverage, and missing events do not
              establish that an account was never used.
            </P>
            <div
              className="docs-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Troubleshooting reference"
            >
              <table className="docs-table">
                <thead>
                  <tr>
                    <th scope="col">What you see</th>
                    <th scope="col">What it means</th>
                    <th scope="col">What to do</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Account unavailable</td>
                    <td>The account read failed or has not completed.</td>
                    <td>
                      Refresh the account. Do not assume it needs registration.
                    </td>
                  </tr>
                  <tr>
                    <td>Recipient not registered</td>
                    <td>
                      The address has no confidential account in this
                      deployment.
                    </td>
                    <td>
                      Ask the recipient to connect and register on the same
                      Testnet deployment.
                    </td>
                  </tr>
                  <tr>
                    <td>Incoming funds</td>
                    <td>The funds are in receiving, not yet spendable.</td>
                    <td>
                      Merge incoming funds after the deposit or transfer is
                      confirmed.
                    </td>
                  </tr>
                  <tr>
                    <td>Confirmation uncertain</td>
                    <td>
                      A response was lost or the confirmation wait timed out.
                    </td>
                    <td>
                      Inspect the transaction link, activity and account/run
                      state before retrying. Retrying an accepted payment can
                      pay twice.
                    </td>
                  </tr>
                  <tr>
                    <td>Local state mismatch</td>
                    <td>
                      Cached confidential state does not agree with the chain.
                    </td>
                    <td>
                      Try ordinary refresh first. Keep browser storage. Full
                      replay can fail with incomplete historical events.
                    </td>
                  </tr>
                  <tr>
                    <td>Older activity absent</td>
                    <td>
                      Available event coverage may not include older
                      transactions.
                    </td>
                    <td>
                      Check indexer coverage with the operator. Do not interpret
                      the recent feed as an all-time statement.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Callout>
              Clearing storage can discard confidential state and retained proof
              openings. Re-deriving keys from the same wallet is not a guarantee
              that complete balances or sender disclosures can be reconstructed
              without the missing history. The existing full-replay action is an
              advanced recovery operation, not a routine reset.
            </Callout>
          </section>
          <section className="docs-section" aria-labelledby="contracts">
            <H2 id="contracts">Contracts</H2>
            <P>
              These public IDs come from the app’s current Testnet deployment
              configuration; optional contracts can be unconfigured. Source is
              available on GitHub, built on{" "}
              <Code>OpenZeppelin/stellar-contracts</Code>.
            </P>
            <div className="mb-8 rounded-xl border border-border bg-white/[0.02] px-5">
              {Object.entries(addresses).map(([name, addr]) => (
                <AddressRow key={name} name={name} addr={addr} />
              ))}
            </div>
          </section>
          <section className="docs-section" aria-labelledby="faq">
            <H2 id="faq">FAQ</H2>
            <div className="docs-topics">
              <div className="docs-topic">
                <H3>Can anyone see my balance?</H3>
                <P>
                  Balances use Pedersen commitments on-chain. Your browser
                  reconstructs confidential state from encrypted events and
                  retains openings locally. Auditor keys can reveal covered
                  data; the Testnet demo key is publicly known.
                </P>
              </div>
              <div className="docs-topic">
                <H3>Does the escrow arbiter see the locked amount?</H3>
                <P>
                  The arbiter role alone does not reveal the amount. An arbiter
                  who also holds the relevant auditor key can decrypt covered
                  amounts, including with a public demo key.
                </P>
              </div>
              <div className="docs-topic">
                <H3>
                  Auditor console vs. selective disclosure — which one do I
                  want?
                </H3>
                <P>
                  Auditor if you need standing, ongoing visibility into every
                  amount under an auditor id — the compliance relationship
                  Payroll is built around. Selective disclosure if you need to
                  prove just one payment to one party who shouldn&apos;t get
                  broader access — see{" "}
                  <a
                    href="#disclosure"
                    className="text-accent transition-colors hover:text-accent-hover"
                  >
                    Selective Disclosure
                  </a>{" "}
                  above.
                </P>
              </div>
              <div className="docs-topic">
                <H3>Is Lucent audited?</H3>
                <P>
                  No. Lucent runs on Stellar testnet and the UltraHonk verifier
                  and circuits are unaudited. Do not use it with real value.
                </P>
              </div>
              <div className="docs-topic">
                <H3>What happens if I lose my wallet?</H3>
                <P>
                  Confidential keys are derived deterministically from a
                  Freighter signature, so they can be re-derived from the same
                  wallet. Local balance state and proof openings still matter.
                  Replay can reconstruct only what the available events and keys
                  permit. With older history outside the RPC retention window,
                  complete recovery is not guaranteed. Do not clear browser
                  storage as a routine fix.
                </P>
              </div>
              <div className="docs-topic">
                <H3>Where is the source code?</H3>
                <P>
                  The contracts and frontend are open source on{" "}
                  <a
                    href="https://github.com/ToluLabs/Lucent"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent transition-colors hover:text-accent-hover"
                  >
                    GitHub
                  </a>
                  .
                </P>
              </div>
            </div>
          </section>
        </article>
      </div>
      <Modal
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        title="Documentation topics"
      >
        {navigation(true)}
      </Modal>
    </PublicShell>
  );
}
