"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { StrKey } from "@stellar/stellar-sdk";
import { CheckCircle, ExternalLink, Lock } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { NumericKeypad } from "@/components/ui/NumericKeypad";
import { AddressDisplay } from "@/components/ui/AddressDisplay";
import { ProofStatusPill } from "@/components/ui/ProofStatusPill";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ProofLoadingOverlay } from "@/components/ui/ProofLoadingOverlay";
import { Callout } from "@/components/ui/Callout";
import { useWallet } from "@/lib/wallet-context";
import { useRequireWallet } from "@/lib/use-require-wallet";
import { ConnectPrompt } from "@/components/ui/ConnectPrompt";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useAction } from "@/lib/use-action";
import { toBaseUnits, formatAmount, DECIMALS } from "@/lib/amount";

type Step = "recipient" | "amount" | "confirm";
type RecipientCheck = {
  address: string;
  wallet: object;
  status: "checking" | "registered" | "unregistered" | "error";
};

export default function SendPage() {
  const wallet = useRequireWallet();
  const { view, error, setError } = useWallet();
  const { run, busy, phase } = useAction();
  const [step, setStep] = useState<Step>("recipient");
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
    if (!recipientReady) { setStep("recipient"); return; }
    setTxHash(null);
    await run("send", async (sp) => {
      const r = await wallet!.transfer(to.trim(), toBaseUnits(amount || "0"), sp);
      setTxHash(r.hash);
    });
  }

  if (txHash) {
    return (
      <AppShell>
        <div className="flex min-h-[80dvh] flex-col items-center justify-center gap-6 px-4">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="flex h-20 w-20 items-center justify-center rounded-3xl border border-success/20 bg-success/10"
          >
            <CheckCircle className="h-10 w-10 text-success" />
          </motion.div>
          <div className="text-center">
            <h2 className="font-display text-xl font-semibold text-text-primary">Sent</h2>
            <p className="mt-1 text-sm text-text-secondary">{amount} USDC sent confidentially</p>
          </div>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 font-mono text-xs text-accent hover:text-accent-hover"
          >
            {txHash.slice(0, 12)}… <ExternalLink className="h-3 w-3" />
          </a>
          <Button
            size="lg"
            onClick={() => {
              setTxHash(null);
              setTo("");
              setAmount("");
              setStep("recipient");
            }}
          >
            Send Another
          </Button>
        </div>
      </AppShell>
    );
  }

  const steps: Step[] = ["recipient", "amount", "confirm"];
  const stepIndex = steps.indexOf(step);
  const spendable = view?.spendable ?? 0n;
  const registered = view?.registered ?? false;

  return (
    <AppShell>
      <PageHeader title="Send" showBack={step !== "recipient"} onBack={() => setStep(steps[stepIndex - 1] ?? "recipient")} />

      <div className="flex flex-col gap-5 px-4 pb-6 md:mx-auto md:max-w-2xl md:px-8">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        {!registered && (
          <Callout>
            You need to register your confidential account before you can send — head to{" "}
            <strong>Home</strong> to register, a one-time proof.
          </Callout>
        )}

        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= stepIndex ? "bg-accent" : "bg-border"}`} />
          ))}
        </div>
        <span className="-mt-2 text-xs text-text-muted">
          Step {stepIndex + 1} of 3 — {step === "recipient" ? "Recipient" : step === "amount" ? "Amount" : "Confirm"}
        </span>

        {step === "recipient" && (
          <>
            <GlassCard padding="md">
              <Input
                label="Recipient address"
                placeholder="G…"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={`font-mono ${recipientError ? "border-error/50" : ""}`}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!recipientError}
                aria-describedby="recipient-status"
              />
              <div id="recipient-status" role="status" aria-live="polite" className="mt-3 text-xs">
                {recipientError ? <p className="text-error">{recipientError}</p> :
                  recipientReady ? <p className="text-success">Registered with Lucent on Testnet.</p> :
                  validAddress ? <p className="text-text-muted">Checking registration…</p> :
                  <p className="text-text-muted">Paste the recipient’s Stellar public address. We’ll check their Lucent registration before you continue.</p>}
                {recipientStatus === "error" && <button type="button" className="mt-2 text-accent underline" onClick={() => setCheckAttempt(n => n + 1)}>Retry registration check</button>}
              </div>
            </GlassCard>

            <Button fullWidth size="lg" disabled={!recipientReady || !registered} onClick={() => setStep("amount")}>
              Continue
            </Button>
          </>
        )}

        {step === "amount" && (
          <>
            <GlassCard padding="sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">To</span>
                <AddressDisplay address={to} chars={8} />
              </div>
            </GlassCard>

            <GlassCard padding="md">
              <NumericKeypad
                value={amount}
                onChange={setAmount}
                unit="USDC"
                maxValue={formatAmount(spendable, DECIMALS)}
                onMax={() => setAmount(formatAmount(spendable, DECIMALS))}
              />
            </GlassCard>

            <div className="flex justify-center">
              <ProofStatusPill status="idle" />
            </div>

            <Button fullWidth size="lg" disabled={!recipientReady || !amount || amount === "0"} onClick={() => setStep("confirm")}>
              Preview Send
            </Button>
          </>
        )}

        {step === "confirm" && (
          <>
            <GlassCard padding="md">
              <div className="flex flex-col gap-4">
                <SectionLabel>Transfer Details</SectionLabel>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">To</span>
                  <AddressDisplay address={to} chars={8} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Amount</span>
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3 w-3 text-accent" />
                    <span className="font-mono text-sm text-text-primary">{amount} USDC</span>
                  </div>
                </div>

                <div className="h-px bg-border" />

                <p className="text-xs leading-relaxed text-text-muted">
                  Amount is proven in your browser before submission — it will never appear in
                  plaintext on-chain.
                </p>

                <div className="flex justify-center">
                  <ProofStatusPill status={busy === "send" ? "encrypting" : "idle"} />
                </div>
              </div>
            </GlassCard>

            <Button fullWidth size="lg" disabled={!recipientReady} isLoading={busy === "send"} onClick={submit}>
              Send
            </Button>
          </>
        )}
      </div>

      <ProofLoadingOverlay open={busy === "send" && phase === "proving"} estSeconds={12} fullScreen />
    </AppShell>
  );
}
