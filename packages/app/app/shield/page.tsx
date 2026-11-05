"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { AmountField } from "@/components/ui/AmountField";
import { Segmented } from "@/components/ui/Segmented";
import { ProofStatusPill } from "@/components/ui/ProofStatusPill";
import { TxStatus, type TxStep } from "@/components/ui/TxStatus";
import { ProofLoadingOverlay } from "@/components/ui/ProofLoadingOverlay";
import { Callout } from "@/components/ui/Callout";
import { useWallet } from "@/lib/wallet-context";
import { useRequireWallet } from "@/lib/use-require-wallet";
import { ConnectPrompt } from "@/components/ui/ConnectPrompt";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { useAction } from "@/lib/use-action";
import { toBaseUnits, formatAmount, formatMoney, displayAmount, DECIMALS } from "@/lib/amount";

type Tab = "deposit" | "withdraw";

export default function ShieldPage() {
  const wallet = useRequireWallet();
  const { view, error, setError } = useWallet();
  const { run, busy, phase } = useAction();
  const [tab, setTab] = useState<Tab>("deposit");
  const [depositAmt, setDepositAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [steps, setSteps] = useState<TxStep[]>([]);

  if (!wallet) {
    return (
      <AppShell>
        <PageHeader title="Shield" showBack={false} />
        <ConnectPrompt message="Connect your wallet to deposit, withdraw, and shield USDC into a confidential balance." />
      </AppShell>
    );
  }

  const registered = view?.registered ?? false;
  const receiving = view?.receiving ?? 0n;
  const spendable = view?.spendable ?? 0n;
  const publicUSDC = view?.publicUSDC ?? 0n;

  async function deposit() {
    if (!depositAmt) return;
    await run("deposit", async () => {
      await wallet!.deposit(toBaseUnits(depositAmt));
      setDepositAmt("");
    });
  }

  async function withdraw() {
    if (!withdrawAmt) return;
    setSteps([
      { id: "prove", label: "Generate withdraw proof", status: "active", estSeconds: 12 },
      { id: "submit", label: "Submit withdrawal", status: "pending" },
    ]);
    await run("withdraw", async (sp) => {
      await wallet!.withdraw(toBaseUnits(withdrawAmt), (p) => {
        sp(p);
        setSteps((s) =>
          s.map((x) =>
            p === "submitting"
              ? x.id === "prove"
                ? { ...x, status: "done" }
                : x.id === "submit"
                  ? { ...x, status: "active" }
                  : x
              : x,
          ),
        );
      });
      setSteps((s) => s.map((x) => ({ ...x, status: "done" })));
      setWithdrawAmt("");
    });
    setTimeout(() => setSteps([]), 1500);
  }

  const isProving = busy === "withdraw" && phase === "proving";
  const amount = tab === "deposit" ? depositAmt : withdrawAmt;
  const setAmount = tab === "deposit" ? setDepositAmt : setWithdrawAmt;
  const limit = tab === "deposit" ? publicUSDC : spendable;

  return (
    <AppShell wide>
      <PageHeader
        title="Shield"
        subtitle="Move USDC between your public wallet and your confidential balance."
        showBack={false}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-5 px-4 pb-10 md:px-8"
      >
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        {!registered && (
          <Callout>
            You need to register your confidential account before you can deposit or withdraw. Head to{" "}
            <strong>Home</strong>{" "}to register, a one-time proof.
          </Callout>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Form */}
          <section className="glass-card flex flex-col gap-6 p-5 md:p-7">
            <Segmented
              value={tab}
              onChange={setTab}
              ariaLabel="Shield direction"
              options={[
                { value: "deposit", label: "Deposit" },
                { value: "withdraw", label: "Withdraw" },
              ]}
            />

            {tab === "withdraw" && receiving > 0n && (
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-text-secondary">
                  {displayAmount(receiving)} is still unmerged. Merge it before withdrawing more than your spendable balance.
                </span>
                <Button size="sm" variant="secondary" isLoading={busy === "merge"} onClick={() => run("merge", () => wallet!.merge())}>
                  Merge
                </Button>
              </div>
            )}

            <AmountField
              value={amount}
              onChange={setAmount}
              unit="USDC"
              maxValue={formatAmount(limit, DECIMALS)}
              onMax={() => setAmount(formatAmount(limit, DECIMALS))}
            />

            {tab === "deposit" && (
              <p className="text-sm text-text-muted">
                Need testnet USDC?{" "}
                <a
                  href="https://faucet.circle.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent underline underline-offset-2 hover:text-accent-hover"
                >
                  Get some from the Circle faucet
                </a>
                . It is free and needs no account.
              </p>
            )}

            {steps.length > 0 && tab === "withdraw" && <TxStatus steps={steps} />}

            <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
              <ProofStatusPill status={isProving ? "encrypting" : "idle"} />
              {tab === "deposit" ? (
                <Button size="lg" isLoading={busy === "deposit"} disabled={!depositAmt || !registered} onClick={deposit} className="sm:min-w-[220px]">
                  Deposit {depositAmt || "0"} USDC
                </Button>
              ) : (
                <Button size="lg" isLoading={busy === "withdraw"} disabled={!withdrawAmt || !registered} onClick={withdraw} className="sm:min-w-[220px]">
                  Withdraw {withdrawAmt || "0"} USDC
                </Button>
              )}
            </div>
          </section>

          {/* Summary */}
          <aside className="flex flex-col gap-4">
            <div className="glass-card overflow-hidden">
              <div className="border-b border-border bg-card/50 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
                Balances
              </div>
              {[
                { label: "Public wallet", value: publicUSDC, note: "Visible on-chain" },
                { label: "Receiving", value: receiving, note: "Confidential, unmerged" },
                { label: "Spendable", value: spendable, note: "Confidential, ready" },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-4 border-t border-border px-5 py-4 first:border-t-0">
                  <div>
                    <div className="text-sm font-medium">{r.label}</div>
                    <div className="text-xs text-text-muted">{r.note}</div>
                  </div>
                  <div className="font-mono text-sm tabular-nums">{formatMoney(r.value)}</div>
                </div>
              ))}
            </div>
            <p className="px-1 text-sm leading-relaxed text-text-muted">
              {tab === "deposit"
                ? "A deposit is the one public amount in Lucent. It lands in your receiving balance at 1:1 and needs no proof."
                : "Withdrawing generates a zero-knowledge proof in your browser, then returns public USDC to your wallet."}
            </p>
          </aside>
        </div>
      </motion.div>

      <ProofLoadingOverlay open={busy === "withdraw" && phase === "proving"} estSeconds={12} fullScreen />
    </AppShell>
  );
}
