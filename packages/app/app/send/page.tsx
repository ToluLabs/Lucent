"use client";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { ConnectPrompt } from "@/components/ui/ConnectPrompt";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { AmountInput } from "@/components/ui/AmountInput";
import { ProofLoadingOverlay } from "@/components/ui/ProofLoadingOverlay";
import {
  DECIMALS,
  formatAmount,
  toBaseUnits,
  validPayment,
} from "@/lib/amount";
import { useAction } from "@/lib/use-action";
import { useRequireWallet } from "@/lib/use-require-wallet";
import { useWallet } from "@/lib/wallet-context";
import { StrKey } from "@stellar/stellar-sdk";
import { CheckCircle, Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Step = "recipient" | "amount" | "confirm";
type RecipientCheck = {
  address: string;
  wallet: object;
  status: "checking" | "registered" | "unregistered" | "error";
};

export default function SendPage() {
  const wallet = useRequireWallet();
  const { view, error, setError } = useWallet();
  const { run, busy, phase, uncertain } = useAction();
  const [step, setStep] = useState<Step>("recipient");
  const [to, setTo] = useState("");
  const [recipientCheck, setRecipientCheck] = useState<RecipientCheck | null>(
    null,
  );
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
        if (!cancelled)
          setRecipientCheck({
            address,
            wallet,
            status: registered ? "registered" : "unregistered",
          });
      } catch {
        if (!cancelled) setRecipientCheck({ address, wallet, status: "error" });
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wallet, to, checkAttempt]);

  const recipientAddress = to.trim();
  const validAddress = StrKey.isValidEd25519PublicKey(recipientAddress);
  const recipientStatus =
    recipientCheck?.wallet === wallet &&
    recipientCheck.address === recipientAddress
      ? recipientCheck.status
      : null;
  const recipientReady = validAddress && recipientStatus === "registered";
  const recipientError =
    recipientAddress && !validAddress
      ? "Enter a valid Stellar public address beginning with G."
      : recipientStatus === "unregistered"
        ? "This address is not registered with Lucent on Testnet. Ask the recipient to connect and register first."
        : recipientStatus === "error"
          ? "Could not check registration. Retry to continue."
          : undefined;

  if (!wallet)
    return (
      <AppShell>
        <PageHeader title="Payments" />
        <ConnectPrompt message="Connect your wallet to send a confidential payment." />
      </AppShell>
    );
  const spendable = view?.spendable ?? 0n;
  const ready = !!view?.registered && view.matchesChain;
  const amountReady = validPayment(amount, spendable);
  async function submit() {
    if (!recipientReady || !amountReady || !ready) return;
    await run("send", async (sp) => {
      const result = await wallet!.transfer(
        recipientAddress,
        toBaseUnits(amount),
        sp,
      );
      setTxHash(result.hash);
    });
  }
  if (txHash)
    return (
      <AppShell>
        <PageHeader title="Payments" />
        <div className="workspace-page">
          <GlassCard padding="lg" className="mx-auto max-w-3xl">
            <div role="status">
              <CheckCircle className="mb-5 h-10 w-10 text-success" />
              <p className="eyebrow">Confirmed on Stellar Testnet</p>
              <h2 className="mt-3 text-3xl font-semibold">Payment sent.</h2>
              <p className="mt-4 text-lg tabular-nums">{amount} USDC</p>
              <p className="mt-2 break-all font-mono text-sm text-text-secondary">
                {recipientAddress}
              </p>
              <p className="my-5 text-sm leading-6 text-text-secondary">
                The transfer is confirmed. The recipient will need to merge
                incoming funds before spending.
              </p>
            </div>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block py-3 text-sm text-accent"
            >
              View confirmed transaction ↗
            </a>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  setTxHash(null);
                  setAmount("");
                  setTo("");
                  setStep("recipient");
                }}
              >
                Make another payment
              </Button>
              <Link
                href="/home"
                className="rounded-lg border border-border px-5 py-3 text-sm"
              >
                Back to overview
              </Link>
            </div>
          </GlassCard>
        </div>
      </AppShell>
    );
  return (
    <AppShell>
      <PageHeader title="Payments" />
      <div className="workspace-page space-y-6">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        {!ready && (
          <Callout>
            {!view
              ? "Account status is unavailable. Refresh your account before paying."
              : !view.registered
                ? "Register your confidential account from Overview before paying."
                : "Local state does not match the chain. Refresh and inspect account settings before paying."}{" "}
            <Link href="/home" className="underline">
              Go to Overview
            </Link>
          </Callout>
        )}
        <div className="workspace-grid">
          <GlassCard padding="lg">
            <p className="eyebrow">
              {step === "confirm"
                ? "02 · Review payment"
                : "01 · Payment details"}
            </p>
            <h2 className="mb-7 mt-3 text-xl font-semibold">
              {step === "confirm"
                ? "Check before you send"
                : "New confidential payment"}
            </h2>
            {step !== "confirm" ? (
              <form
                className="space-y-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (recipientReady && amountReady && ready)
                    setStep("confirm");
                }}
              >
                <Input
                  label="Recipient Stellar address"
                  placeholder="G…"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono text-sm"
                  error={recipientError}
                  aria-describedby="recipient-status"
                />
                <div
                  id="recipient-status"
                  role="status"
                  aria-live="polite"
                  className="text-sm leading-6"
                >
                  {recipientReady ? (
                    <span className="text-success">
                      ✓ Registered with Lucent on Testnet
                    </span>
                  ) : validAddress &&
                    recipientStatus !== "unregistered" &&
                    recipientStatus !== "error" ? (
                    <span className="text-text-secondary">
                      Checking registration…
                    </span>
                  ) : (
                    <span className="text-text-muted">
                      We check registration before you can review this payment.
                    </span>
                  )}
                  {recipientStatus === "error" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setCheckAttempt((n) => n + 1)}
                    >
                      Retry check
                    </Button>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-text-secondary">
                    Asset
                  </p>
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <span className="font-medium">USDC</span>
                    <span className="text-xs text-text-muted">
                      Stellar Testnet · confidential transfer
                    </span>
                  </div>
                </div>
                <AmountInput
                  value={amount}
                  onChange={setAmount}
                  maxValue={formatAmount(spendable, DECIMALS)}
                  onMax={() => setAmount(formatAmount(spendable, DECIMALS))}
                />
                <Button
                  type="submit"
                  disabled={
                    !recipientReady ||
                    !amountReady ||
                    !ready ||
                    !!busy ||
                    uncertain
                  }
                >
                  Review payment
                </Button>
              </form>
            ) : (
              <div className="space-y-6">
                <dl className="space-y-5">
                  <div>
                    <dt className="text-sm text-text-muted">Recipient</dt>
                    <dd className="mt-2 break-all font-mono text-sm">
                      {recipientAddress}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-sm text-text-muted">Amount</dt>
                    <dd className="font-sans text-xl tabular-nums">
                      {amount} USDC
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-border pt-5">
                    <dt className="text-sm text-text-muted">
                      Available after payment
                    </dt>
                    <dd className="font-sans text-sm tabular-nums">
                      {formatAmount(spendable - toBaseUnits(amount), 7)} USDC
                    </dd>
                  </div>
                </dl>
                <p className="rounded-lg border border-border p-4 text-sm leading-6 text-text-secondary">
                  Freighter will request approval after the proof is generated.
                  Check the network and simulated fee in your wallet.
                  Confirmation can take time; keep this page open.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={
                      !ready ||
                      !recipientReady ||
                      !amountReady ||
                      !!busy ||
                      uncertain
                    }
                    isLoading={busy === "send"}
                    onClick={submit}
                  >
                    Confirm and send
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={!!busy}
                    onClick={() => setStep("recipient")}
                  >
                    Edit details
                  </Button>
                </div>
              </div>
            )}
          </GlassCard>
          <aside className="space-y-5">
            <GlassCard padding="lg">
              <div className="mb-4 flex items-center gap-2">
                <Lock className="h-4 w-4 text-accent" />
                <h2 className="font-semibold">What stays confidential?</h2>
              </div>
              <p className="text-sm leading-7 text-text-secondary">
                The transfer amount is committed and encrypted. Sender,
                recipient and transaction metadata remain public. The designated
                auditor can decrypt covered amounts; the demo auditor key is
                publicly available.
              </p>
            </GlassCard>
            <div className="p-3">
              <h3 className="text-sm font-semibold">
                A clear path to confirmation
              </h3>
              <ol className="mt-4 space-y-4 text-sm text-text-secondary">
                <li>1. Validate and review</li>
                <li>2. Generate a proof locally</li>
                <li>3. Approve in Freighter</li>
                <li>4. Submit and wait for network confirmation</li>
              </ol>
              <p className="mt-5 text-xs leading-6 text-text-muted">
                Network fees use XLM. No fee estimate is displayed until
                transaction simulation. A missing response is not proof that
                payment failed.
              </p>
            </div>
          </aside>
        </div>
      </div>
      <ProofLoadingOverlay
        open={busy === "send" && phase === "proving"}
        fullScreen
      />
    </AppShell>
  );
}
