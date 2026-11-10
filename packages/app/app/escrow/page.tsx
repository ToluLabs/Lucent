"use client";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { AddressDisplay } from "@/components/ui/AddressDisplay";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { ConnectPrompt } from "@/components/ui/ConnectPrompt";
import { EncryptedBadge } from "@/components/ui/EncryptedBadge";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { GlassCard } from "@/components/ui/GlassCard";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { ProofLoadingOverlay } from "@/components/ui/ProofLoadingOverlay";
import {
  DECIMALS,
  displayAmount,
  formatAmount,
  toBaseUnits,
  validPayment,
} from "@/lib/amount";
import { cn } from "@/lib/cn";
import { DEPLOYMENT } from "@/lib/deployment";
import { errMsg } from "@/lib/err";
import { ESCROW_STATE_LABEL, formatCountdown } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import { useRequireWallet } from "@/lib/use-require-wallet";
import { useWallet } from "@/lib/wallet-context";
import { EscrowState, type EscrowInfo } from "@lucent/sdk";
import { StrKey } from "@stellar/stellar-sdk";
import { AlertTriangle, ChevronDown, Lock } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Row = { id: bigint; address: string; info: EscrowInfo };
type Filter = "all" | "depositor" | "recipient" | "arbiter";

const STATE_TONE: Record<EscrowState, PillTone> = {
  [EscrowState.Created]: "neutral",
  [EscrowState.Funded]: "sky",
  [EscrowState.Completed]: "amber",
  [EscrowState.Released]: "green",
  [EscrowState.Disputed]: "violet",
  [EscrowState.Refunded]: "red",
  [EscrowState.Cancelled]: "neutral",
};

const STEPS = [
  { state: EscrowState.Created, label: "Created" },
  { state: EscrowState.Funded, label: "Funded" },
  { state: EscrowState.Completed, label: "Completed" },
  { state: EscrowState.Released, label: "Released" },
];

const TIMEOUT_OPTIONS = [
  { label: "1h", seconds: 3600n },
  { label: "24h", seconds: 86400n },
  { label: "7d", seconds: 604800n },
  { label: "30d", seconds: 2592000n },
];

/**
 * Time the depositor has to `release()` after the recipient marks delivery,
 * before the recipient can claim (no arbiter) or dispute (arbiter set).
 * Matches `RELEASE_WINDOW` in contracts/escrow-instance/src/lib.rs — fixed by
 * the contract, not configurable per-escrow the way the timeout is.
 */
const RELEASE_WINDOW_SECONDS = 600;

export default function EscrowPage() {
  const wallet = useRequireWallet();
  const { view, error, setError } = useWallet();
  const { run, busy, phase, uncertain } = useAction();

  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    key: string;
    fn: () => Promise<void>;
  } | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [arbiter, setArbiter] = useState("");
  const [timeoutIdx, setTimeoutIdx] = useState(1);
  const [pendingFund, setPendingFund] = useState<{
    id: bigint;
    address: string;
    recipient: string;
  } | null>(null);
  const [fundAmount, setFundAmount] = useState("");

  const configured = Boolean(DEPLOYMENT.contracts.escrowFactory);
  const me = wallet?.address;

  const reload = useCallback(() => {
    if (!wallet || !configured) return;
    setLoadError(null);
    wallet
      .listEscrows()
      .then(setRows)
      .catch((e) => {
        setError(errMsg(e));
        setLoadError(errMsg(e));
      });
  }, [wallet, configured, setError]);

  useEffect(reload, [reload]);

  if (!wallet) {
    return (
      <AppShell>
        <PageHeader title="Escrow" showBack={false} />
        <ConnectPrompt message="Connect your wallet to create or manage a confidential escrow." />
      </AppShell>
    );
  }

  if (!configured) {
    return (
      <AppShell>
        <PageHeader title="Escrow" showBack={false} />
        <div className="px-4  md:px-8">
          <GlassCard padding="md">
            <p className="text-sm text-text-secondary">
              PrivateEscrow hasn&apos;t been deployed to this environment yet.
              Run{" "}
              <span className="font-mono text-accent">
                pnpm deploy:contracts
              </span>{" "}
              and rebuild the app.
            </p>
          </GlassCard>
        </div>
      </AppShell>
    );
  }

  const filtered = (rows ?? []).filter((r) => {
    if (filter === "depositor") return r.info.depositor === me;
    if (filter === "recipient") return r.info.recipient === me;
    if (filter === "arbiter") return r.info.arbiter === me;
    return true;
  });

  async function createEscrow() {
    if (
      !StrKey.isValidEd25519PublicKey(recipient.trim()) ||
      (arbiter.trim() && !StrKey.isValidEd25519PublicKey(arbiter.trim()))
    ) {
      setError("Enter valid Stellar G addresses for participants.");
      return;
    }
    await run(
      "create",
      async () => {
        const c = await wallet!.createEscrow(
          recipient.trim(),
          arbiter.trim() || null,
          TIMEOUT_OPTIONS[timeoutIdx].seconds,
        );
        setShowCreate(false);
        setPendingFund({
          id: c.id,
          address: c.address,
          recipient: recipient.trim(),
        });
        setRecipient("");
        setArbiter("");
      },
      { refresh: false },
    );
    reload();
  }

  async function confirmFund() {
    if (!pendingFund || !validPayment(fundAmount, view?.spendable ?? 0n))
      return;
    if (toBaseUnits(fundAmount) > (view?.spendable ?? 0n)) {
      setError("Amount exceeds your spendable balance");
      return;
    }
    await run("fund", async (sp) => {
      await wallet!.fundEscrow(
        pendingFund.address,
        pendingFund.recipient,
        toBaseUnits(fundAmount),
        sp,
      );
      setPendingFund(null);
      setFundAmount("");
    });
    reload();
  }

  function act(key: string, fn: () => Promise<void>) {
    setConfirmation({ key, fn });
  }

  const registered = !!view?.registered && view.matchesChain;
  const spendable = view?.spendable ?? 0n;
  const fundExceedsBalance = toBaseUnits(fundAmount || "0") > spendable;

  return (
    <AppShell>
      <PageHeader
        title="Escrow"
        showBack={false}
        right={
          <Button
            size="sm"
            variant="secondary"
            disabled={!registered || !!busy || uncertain}
            onClick={() => setShowCreate(true)}
          >
            New
          </Button>
        }
      />

      <div className="flex flex-col gap-5 px-4 pb-6  md:px-8">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        <Callout>
          <strong>Experimental custody.</strong> The depositor retains the
          escrow account key and can invalidate prepared payouts by spending
          outside this workflow. This is not trustless custody. Use test funds
          only. Amounts are encrypted; participants, lifecycle and metadata are
          public.
        </Callout>
        {loadError && (
          <div>
            <ErrorBanner error={loadError} />
            <Button className="mt-3" variant="secondary" onClick={reload}>
              Retry loading escrows
            </Button>
          </div>
        )}

        {!registered && (
          <Callout>
            You need to register your confidential account before you can create
            an escrow — head to{" "}
            <Link href="/home" className="underline">
              Overview
            </Link>{" "}
            to register, a one-time proof.
          </Callout>
        )}

        <div className="flex flex-wrap gap-2">
          {(["all", "depositor", "recipient", "arbiter"] as Filter[]).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-colors",
                  filter === f
                    ? "bg-accent-bg text-accent"
                    : "border border-border text-text-muted hover:text-text-secondary",
                )}
              >
                {f === "all" ? "All" : `As ${f}`}
              </button>
            ),
          )}
        </div>

        {loadError ? null : rows === null ? (
          <p className="py-12 text-center text-sm text-text-muted">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="glass-card flex h-14 w-14 items-center justify-center">
              <Lock className="h-6 w-6 text-text-muted" />
            </div>
            <p className="text-sm text-text-muted">No escrows yet</p>
            <Button
              disabled={!registered || !!busy || uncertain}
              onClick={() => setShowCreate(true)}
            >
              Create Escrow
            </Button>
          </div>
        ) : (
          <div className="grid items-start gap-4 xl:grid-cols-2">
            {filtered.map((r) => (
              <EscrowRow
                key={r.address}
                row={r}
                me={me}
                wallet={wallet}
                busy={busy}
                open={expanded === r.address}
                onToggle={() =>
                  setExpanded((e) => (e === r.address ? null : r.address))
                }
                act={act}
                onFund={() => {
                  setFundAmount("");
                  setPendingFund({
                    id: r.id,
                    address: r.address,
                    recipient: r.info.recipient,
                  });
                }}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={showCreate}
        onClose={() => !(busy === "create") && setShowCreate(false)}
        title="New escrow agreement"
        busy={!!busy}
      >
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        <Input
          label="Recipient"
          placeholder="G…"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="font-mono"
        />
        <div className="flex flex-col gap-2">
          <Input
            label="Arbiter (optional)"
            placeholder="G… or leave blank"
            value={arbiter}
            onChange={(e) => setArbiter(e.target.value)}
            className="font-mono"
          />
          {!arbiter.trim() && (
            <div className="flex items-start gap-2 rounded-xl border border-warning/20 bg-warning/[0.08] px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <p className="text-xs leading-relaxed text-warning">
                Without an arbiter, disputes are unavailable. The recipient can
                claim after marking delivery and waiting through the contract
                release window; the experimental custody limitation still
                applies.
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-sans text-xs uppercase tracking-wider text-text-muted">
            Timeout — depositor reclaims if no delivery
          </span>
          <div className="grid grid-cols-4 gap-2">
            {TIMEOUT_OPTIONS.map((o, i) => (
              <button
                key={o.label}
                onClick={() => setTimeoutIdx(i)}
                className={cn(
                  "rounded-xl py-2 text-sm font-medium transition-all",
                  i === timeoutIdx
                    ? "bg-accent text-black"
                    : "bg-card text-text-muted hover:text-text-secondary",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-center text-xs leading-relaxed text-text-muted">
          You&apos;ll fund the escrow next.
        </p>
        <Button
          fullWidth
          size="lg"
          isLoading={busy === "create"}
          disabled={!recipient.trim()}
          onClick={createEscrow}
        >
          Create Escrow
        </Button>
      </Modal>

      <Modal
        open={pendingFund !== null}
        busy={!!busy}
        onClose={() => setPendingFund(null)}
        title={`Fund Escrow #${pendingFund?.id.toString() ?? ""}`}
      >
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        <Input
          label="Amount (USDC)"
          value={fundAmount}
          inputMode="decimal"
          onChange={(e) => {
            if (/^\d*(?:\.\d{0,7})?$/.test(e.target.value))
              setFundAmount(e.target.value);
          }}
          error={
            fundExceedsBalance
              ? `Exceeds spendable balance (${displayAmount(spendable)})`
              : undefined
          }
          hint={
            !fundExceedsBalance
              ? `Spendable: ${formatAmount(spendable, DECIMALS)} USDC`
              : undefined
          }
          className="font-mono"
        />
        <p className="text-xs leading-relaxed text-text-muted">
          Funding generates a register proof for the escrow&apos;s confidential
          account, plus the transfer-in and two payout proofs — all in your
          browser. Four wallet confirmations prepare funding, verify both
          payouts, and finally move the funds.
        </p>
        <Button
          fullWidth
          size="lg"
          isLoading={busy === "fund"}
          disabled={
            !registered ||
            !!busy ||
            uncertain ||
            !validPayment(fundAmount, spendable)
          }
          onClick={confirmFund}
        >
          Fund Escrow
        </Button>
      </Modal>

      <Modal
        open={confirmation !== null}
        busy={!!busy}
        onClose={() => setConfirmation(null)}
        title="Review escrow action"
      >
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        <p className="text-sm leading-7 text-text-secondary">
          Action: <strong>{confirmation?.key.split(":")[0]}</strong>. This
          changes the escrow on-chain. Release and arbitration settle the
          prepared payout; a refund returns it to the depositor. Check the
          participants and current lifecycle before approving.
        </p>
        <Button
          disabled={!!busy || uncertain}
          isLoading={!!busy}
          onClick={async () => {
            if (
              confirmation &&
              (await run(confirmation.key, confirmation.fn, { refresh: false }))
            ) {
              setConfirmation(null);
              reload();
            }
          }}
        >
          Confirm in wallet
        </Button>
      </Modal>
      <ProofLoadingOverlay
        open={busy === "fund" && phase === "proving"}
        estSeconds={40}
        message="Generating the escrow proofs in this browser. Keep the tab open. Wallet approvals follow; no settlement is confirmed yet."
        fullScreen
      />
    </AppShell>
  );
}

function EscrowRow({
  row,
  me,
  wallet,
  busy,
  open,
  onToggle,
  act,
  onFund,
}: {
  row: Row;
  me: string | undefined;
  wallet: NonNullable<ReturnType<typeof useWallet>["wallet"]>;
  busy: string | null;
  open: boolean;
  onToggle: () => void;
  onFund: () => void;
  act: (key: string, fn: () => Promise<void>) => void;
}) {
  const { info, address, id } = row;
  const isDepositor = info.depositor === me;
  const isRecipient = info.recipient === me;
  const isArbiter = info.arbiter === me;
  const hasArbiter = info.arbiter !== null;
  const k = (a: string) => `${a}:${address}`;
  const [uri, setUri] = useState("");

  const stateNum = info.state;
  const isHappyPath = stateNum <= EscrowState.Released;
  const sideLabel =
    stateNum === EscrowState.Disputed
      ? "Disputed"
      : stateNum === EscrowState.Refunded
        ? "Refunded"
        : stateNum === EscrowState.Cancelled
          ? "Cancelled"
          : null;

  // Live countdown for the two time-gated transitions: the depositor's
  // self-refund timeout (Funded) and the release window (Completed). Only
  // ticks while expanded and in a state that actually has a deadline —
  // no point re-rendering rows nobody's looking at.
  const tracksDeadline =
    open &&
    (stateNum === EscrowState.Funded || stateNum === EscrowState.Completed);
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!tracksDeadline) return;
    const tickId = setInterval(
      () => setNowSec(Math.floor(Date.now() / 1000)),
      1000,
    );
    return () => clearInterval(tickId);
  }, [tracksDeadline]);

  const timeoutAt = Number(info.timeoutAt);
  const releaseDeadline = Number(info.completedAt) + RELEASE_WINDOW_SECONDS;
  const timeoutReached = stateNum === EscrowState.Funded && nowSec >= timeoutAt;
  const releaseWindowElapsed =
    stateNum === EscrowState.Completed && nowSec >= releaseDeadline;

  return (
    <GlassCard padding="md">
      <button
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-3 text-left"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-bg">
          <Lock className="h-5 w-5 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">
              Escrow #{id.toString()}
            </span>
            <Pill tone={STATE_TONE[stateNum]}>
              {ESCROW_STATE_LABEL[stateNum]}
            </Pill>
          </div>
          <p className="mt-1 text-xs text-text-secondary">
            Your role:{" "}
            {isDepositor
              ? "Depositor"
              : isRecipient
                ? "Recipient"
                : isArbiter
                  ? "Arbiter"
                  : "Observer"}
          </p>
          <AddressDisplay
            address={info.depositor}
            chars={5}
            showCopy={false}
            className="mt-0.5 text-[11px]"
          />
        </div>
        <EncryptedBadge size="sm" />
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4">
          {isHappyPath ? (
            <div className="flex items-center">
              {STEPS.map((step, i) => (
                <div key={step.state} className="contents">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold transition-all",
                        stateNum >= step.state
                          ? "border-accent bg-accent-bg text-accent"
                          : "border-border text-text-muted",
                      )}
                    >
                      {i + 1}
                    </div>
                    <span
                      className={cn(
                        "text-xs",
                        stateNum >= step.state
                          ? "text-accent"
                          : "text-text-muted",
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "mx-1 mb-3 h-px flex-1",
                        stateNum > step.state ? "bg-accent/40" : "bg-border",
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            sideLabel && <Pill tone={STATE_TONE[stateNum]}>{sideLabel}</Pill>
          )}

          <div className="flex flex-col gap-2">
            <Row2 label={`Depositor${isDepositor ? " (you)" : ""}`}>
              <AddressDisplay address={info.depositor} chars={6} />
            </Row2>
            <Row2 label={`Recipient${isRecipient ? " (you)" : ""}`}>
              <AddressDisplay address={info.recipient} chars={6} />
            </Row2>
            {hasArbiter && info.arbiter ? (
              <Row2 label={`Arbiter${isArbiter ? " (you)" : ""}`}>
                <AddressDisplay address={info.arbiter} chars={6} />
              </Row2>
            ) : (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                <span className="text-xs text-warning">
                  No arbiter — disputes not possible
                </span>
              </div>
            )}
          </div>

          {stateNum === EscrowState.Funded && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-white/[0.02] px-3 py-2">
              <span className="text-xs text-text-muted">
                Depositor can self-refund in
              </span>
              <span
                className={cn(
                  "font-sans tabular-nums text-xs font-medium",
                  timeoutReached ? "text-warning" : "text-text-secondary",
                )}
              >
                {timeoutReached ? "Available now" : formatCountdown(timeoutAt)}
              </span>
            </div>
          )}
          {stateNum === EscrowState.Completed && (
            <div className="flex items-center justify-between rounded-xl border border-border bg-white/[0.02] px-3 py-2">
              <span className="text-xs text-text-muted">
                {hasArbiter ? "Dispute opens in" : "Auto-claim opens in"}
              </span>
              <span
                className={cn(
                  "font-sans tabular-nums text-xs font-medium",
                  releaseWindowElapsed ? "text-warning" : "text-text-secondary",
                )}
              >
                {releaseWindowElapsed
                  ? "Available now"
                  : formatCountdown(releaseDeadline)}
              </span>
            </div>
          )}

          <p className="text-xs leading-6 text-text-muted">
            The committed amount is confidential and is not available from the
            agreement metadata. Delivery evidence is public. Marking delivery
            opens a 10-minute release window.
          </p>
          <fieldset
            disabled={!!busy}
            className="flex flex-wrap items-center gap-2"
          >
            {isDepositor && stateNum === EscrowState.Created && (
              <Button size="sm" onClick={onFund}>
                Review funding
              </Button>
            )}
            {isDepositor && stateNum === EscrowState.Created && (
              <Button
                size="sm"
                variant="danger"
                isLoading={busy === k("cancel")}
                onClick={() =>
                  act(k("cancel"), () => wallet.cancelEscrow(address))
                }
              >
                Cancel
              </Button>
            )}
            {isDepositor &&
              (stateNum === EscrowState.Funded ||
                stateNum === EscrowState.Completed) && (
                <Button
                  size="sm"
                  isLoading={busy === k("release")}
                  onClick={() =>
                    act(k("release"), () => wallet.releaseEscrow(address))
                  }
                >
                  Release
                </Button>
              )}
            {isDepositor && stateNum === EscrowState.Funded && (
              <Button
                size="sm"
                variant="secondary"
                disabled={!timeoutReached}
                isLoading={busy === k("timeout")}
                onClick={() =>
                  act(k("timeout"), () => wallet.timeoutEscrow(address))
                }
              >
                {timeoutReached
                  ? "Timeout Refund"
                  : `Timeout Refund (${formatCountdown(timeoutAt)})`}
              </Button>
            )}
            {isRecipient && stateNum === EscrowState.Funded && (
              <div className="flex flex-1 items-center gap-2">
                <div className="flex-1">
                  <Input
                    label="Public delivery evidence URI"
                    placeholder="https://… or ipfs://…"
                    value={uri}
                    onChange={(e) => setUri(e.target.value)}
                    className="h-10 text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!uri.trim()}
                  isLoading={busy === k("mark")}
                  onClick={() =>
                    act(k("mark"), () => wallet.markCompleted(address, uri))
                  }
                >
                  Mark Delivered
                </Button>
              </div>
            )}
            {isRecipient &&
              stateNum === EscrowState.Completed &&
              !hasArbiter && (
                <Button
                  size="sm"
                  disabled={!releaseWindowElapsed}
                  isLoading={busy === k("claim")}
                  onClick={() =>
                    act(k("claim"), () => wallet.claimAfterWindow(address))
                  }
                >
                  {releaseWindowElapsed
                    ? "Claim"
                    : `Claim (${formatCountdown(releaseDeadline)})`}
                </Button>
              )}
            {isRecipient &&
              stateNum === EscrowState.Completed &&
              hasArbiter && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!releaseWindowElapsed}
                  isLoading={busy === k("dispute")}
                  onClick={() =>
                    act(k("dispute"), () => wallet.disputeEscrow(address, uri))
                  }
                >
                  {releaseWindowElapsed
                    ? "Dispute"
                    : `Dispute (${formatCountdown(releaseDeadline)})`}
                </Button>
              )}
            {isArbiter && stateNum === EscrowState.Disputed && (
              <>
                <Button
                  size="sm"
                  isLoading={busy === k("rr")}
                  onClick={() =>
                    act(k("rr"), () => wallet.resolveToRecipient(address))
                  }
                >
                  Award Recipient
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  isLoading={busy === k("rd")}
                  onClick={() =>
                    act(k("rd"), () => wallet.resolveToDepositor(address))
                  }
                >
                  Refund Depositor
                </Button>
              </>
            )}
          </fieldset>
        </div>
      )}
    </GlassCard>
  );
}

function Row2({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-muted">{label}</span>
      {children}
    </div>
  );
}
