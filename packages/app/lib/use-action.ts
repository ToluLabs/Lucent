"use client";

import { useCallback, useState } from "react";

import { useWallet } from "./wallet-context";
import { useToast } from "@/components/ui/Toast";
import { errMsg } from "./err";
import type { TxPhase } from "./wallet";

/** Toast shown when an action completes, keyed by the action name (anything after a ":" is ignored). */
const SUCCESS_TITLE: Record<string, string> = {
  deposit: "Deposit complete",
  withdraw: "Withdrawal complete",
  merge: "Merged into spendable",
  execute: "Payroll executed",
  claim: "Payroll claimed",
  fund: "Escrow funded",
  create: "Escrow created",
  cancel: "Escrow cancelled",
  release: "Escrow released",
  timeout: "Escrow refunded",
  mark: "Marked as delivered",
  dispute: "Dispute opened",
  rr: "Resolved to recipient",
  rd: "Resolved to depositor",
  policyAdd: "Address added to the allowlist",
  policyRemove: "Address removed from the allowlist",
  freeze: "Account frozen",
  unfreeze: "Account unfrozen",
};

/** Escrow row actions use "action:address" keys; this one differs from the payroll action of the same name. */
const SCOPED_TITLE: Record<string, string> = { claim: "Escrow claimed" };

/**
 * Runs a named async action with UI bookkeeping: which action is busy, the
 * proof phase (for the button label), error capture, and a wallet refresh on
 * success. `run(key, fn)`, `fn` receives `setPhase` for proof-carrying ops.
 */
export function useAction() {
  const { refresh, setError } = useWallet();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [phase, setPhase] = useState<TxPhase | null>(null);

  const run = useCallback(
    async (key: string, fn: (setPhase: (p: TxPhase) => void) => Promise<void>, opts?: { refresh?: boolean }) => {
      setError(null);
      setBusy(key);
      setPhase(null);
      try {
        await fn(setPhase);
        if (opts?.refresh !== false) await refresh();
        const [base, scope] = key.split(":");
        const title = (scope ? SCOPED_TITLE[base] : undefined) ?? SUCCESS_TITLE[base];
        if (title) toast.success(title);
      } catch (e) {
        setError(errMsg(e));
      } finally {
        setBusy(null);
        setPhase(null);
      }
    },
    [refresh, setError, toast],
  );

  return { run, busy, phase };
}
