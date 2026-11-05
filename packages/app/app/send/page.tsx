"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { StrKey } from "@stellar/stellar-sdk";
import { CheckCircle, ExternalLink, Lock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AmountField } from "@/components/ui/AmountField";
import { AddressDisplay } from "@/components/ui/AddressDisplay";
import { ProofStatusPill } from "@/components/ui/ProofStatusPill";
import { ProofLoadingOverlay } from "@/components/ui/ProofLoadingOverlay";
import { Callout } from "@/components/ui/Callout";
import { useWallet } from "@/lib/wallet-context";
import { useRequireWallet } from "@/lib/use-require-wallet";
import { ConnectPrompt } from "@/components/ui/ConnectPrompt";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useAction } from "@/lib/use-action";
import { toBaseUnits, formatAmount, formatMoney, DECIMALS } from "@/lib/amount";

type RecipientCheck = {
  address: string;
  wallet: object;
  status: "checking" | "registered" | "unregistered" | "error";
};

export default function SendPage() {
  const wallet = useRequireWallet();
  const { view, error, setError } = useWallet();
  const { run, busy, phase } = useAction();
  const [to, setTo] = useState("");
  const [recipientCheck, setRecipientCheck] = useState<RecipientCheck | null>(null);
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    const address = to.trim();
    if (!wallet || !StrKey.isValidEd25519PublicKey(address)) return;
    let cancelled = false;
    setRecipientCheck({ address, wallet, status: "checking" });
    const timer = setTimeout(async () => {
      try {
        const registered = await wallet.isRecipientRegistered(address);
        if (!cancelled) setRecipientCheck({ address, wallet, status: registered ? "registered" : "unregistered" });
      } catch {
        if (!cancelled) setRecipientCheck({ address, wallet, status: "error" });
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [wallet, to, checkAttempt]);

  const recipientAddress = to.trim();
  const validAddress = StrKey.isValidEd25519PublicKey(recipientAddress);
  const recipientStatus = recipientCheck?.wallet === wallet && recipientCheck.address === recipientAddress
    ? recipientCheck.status : null;
  const recipientReady = validAddress && recipientStatus === "registered";
  const recipientError = recipientAddress && !validAddress
    ? "Enter a valid Stellar public address beginning with G."
    : recipientStatus === "unregistered"
      ? "This address is not registered with Lucent on Testnet. Ask the recipient to connect and register first."
      : recipientStatus === "error"
        ? "Could not check registration. Retry to continue."
        : undefined;

  if (!wallet) {
    return (
      <AppShell>
        <PageHeader title="Send" showBack={false} />
        <ConnectPrompt message="Connect your wallet to send a confidential transfer." />
      </AppShell>
    );
  }

  async function submit() {
    if (!recipientReady) return;
    setTxHash(null);
    await run("send", async (sp) => {
      const r = await wallet!.transfer(to.trim(), toBaseUnits(amount || "0"), sp);
      setTxHash(r.hash);
    });
  }

  if (txHash) {
    return (
      <AppShell>
        <PageHeader title="Sent" subtitle="Your transfer is confirmed on-chain." showBack={false} />
        <div className="px-4 pb-10 md:mx-auto md:max-w-2xl md:px-8">
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="glass-card overflow-hidden"
          >
            <div className="flex items-center gap-3 border-b border-border px-6 py-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success text-void">
                <CheckCircle className="h-4 w-4" />
              </span>
              <div>
                <p className="font-medium">{amount} USDC sent confidentially</p>
                <p className="text-xs text-text-muted">The amount is hidden on-chain. Only you and the recipient can read it.</p>
              </div>
            </div>
            <dl>
              <div className="flex items-center justify-between gap-4 px-6 py-4">
                <dt className="text-sm text-text-muted">To</dt>
                <dd><AddressDisplay address={to.trim()} chars={6} /></dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border px-6 py-4">
                <dt className="text-sm text-text-muted">Transaction</dt>
                <dd>
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 font-mono text-xs text-accent hover:text-accent-hover"
                  >
                    {txHash.slice(0, 10)}…{txHash.slice(-6)} <ExternalLink className="h-3 w-3" />
                  </a>
                </dd>
              </div>
            </dl>
            <div className="flex flex-col gap-3 border-t border-border bg-card/60 px-6 py-5 sm:flex-row">
              <Button
                size="lg"
                onClick={() => {
                  setTxHash(null);
                  setTo("");
                  setAmount("");
                }}
              >
                Send another
              </Button>
              <Link
                href="/home"
                className="inline-flex h-[52px] items-center justify-center rounded-lg border border-border bg-panel px-6 text-[15px] font-semibold shadow-card transition-colors hover:border-border-hover"
              >
                Back to overview
              </Link>
            </div>
          </motion.section>
        </div>
      </AppShell>
    );
  }

  const spendable = view?.spendable ?? 0n;
  const registered = view?.registered ?? false;
  const amountBase = toBaseUnits(amount || "0");
  const overBalance = amountBase > spendable;
  const canSend = recipientReady && registered && amountBase > 0n && !overBalance;

  const recipientNote = recipientError ? (
    <p className="text-error">{recipientError}</p>
  ) : recipientReady ? (
    <p className="flex items-center gap-1.5 text-success">
      <CheckCircle className="h-3.5 w-3.5" /> Registered with Lucent on Testnet.
    </p>
  ) : validAddress ? (
    <p className="text-text-muted">Checking registration…</p>
  ) : (
    <p className="text-text-muted">Paste the recipient's Stellar public address. We check their Lucent registration first.</p>
  );

  return (
    <AppShell wide>
      <PageHeader title="Send" subtitle="Pay any registered account. The amount never appears on-chain." showBack={false} />

      <div className="flex flex-col gap-5 px-4 pb-10 md:px-8">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        {!registered && (
          <Callout>
            You need to register your confidential account before you can send. Head to <strong>Home</strong>{" "}to
            register, a one-time proof.
          </Callout>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="glass-card flex flex-col gap-7 p-5 md:p-7">
            <div className="flex flex-col gap-2">
              <Input
                label="Recipient"
                placeholder="G…"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={`font-mono ${recipientError ? "border-error/50" : ""}`}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!recipientError}
                aria-describedby="recipient-status"
              />
              <div id="recipient-status" role="status" aria-live="polite" className="text-xs">
                {recipientNote}
                {recipientStatus === "error" && (
                  <button type="button" className="mt-2 text-accent underline" onClick={() => setCheckAttempt((n) => n + 1)}>
                    Retry registration check
                  </button>
                )}
              </div>
            </div>

            <AmountField
              value={amount}
              onChange={setAmount}
              unit="USDC"
              maxValue={formatAmount(spendable, DECIMALS)}
              onMax={() => setAmount(formatAmount(spendable, DECIMALS))}
              error={overBalance ? "More than your spendable balance." : undefined}
            />
          </section>

          <aside className="glass-card overflow-hidden lg:sticky lg:top-24">
            <div className="border-b border-border bg-card/50 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
              Summary
            </div>
            <dl className="flex flex-col">
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <dt className="text-sm text-text-muted">To</dt>
                <dd>{validAddress ? <AddressDisplay address={recipientAddress} chars={6} /> : <span className="text-sm text-text-muted">Not set</span>}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-4">
                <dt className="text-sm text-text-muted">Amount</dt>
                <dd className="flex items-center gap-1.5 font-mono text-sm">
                  <Lock className="h-3 w-3 text-encrypted" />
                  {amount || "0"} USDC
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-4">
                <dt className="text-sm text-text-muted">Spendable after</dt>
                <dd className="font-mono text-sm tabular-nums">{formatMoney(spendable > amountBase ? spendable - amountBase : 0n)}</dd>
              </div>
            </dl>
            <div className="flex flex-col gap-4 border-t border-border p-5">
              <p className="text-xs leading-relaxed text-text-muted">
                The amount is proven in your browser before submission. It never appears in plaintext on-chain.
              </p>
              <ProofStatusPill status={busy === "send" ? "encrypting" : "idle"} className="self-start" />
              <Button fullWidth size="lg" disabled={!canSend} isLoading={busy === "send"} onClick={submit}>
                Send
              </Button>
            </div>
          </aside>
        </div>
      </div>

      <ProofLoadingOverlay open={busy === "send" && phase === "proving"} estSeconds={12} fullScreen />
    </AppShell>
  );
}
