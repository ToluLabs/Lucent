"use client";
import { useCallback, useState } from "react";
import { useActionContext } from "./action-context";
import { transactionError } from "./action-result";
import { trackEvent, trackedAction } from "./analytics";
import { errMsg } from "./err";
import type { TxPhase } from "./wallet";
import { useWallet } from "./wallet-context";
export function useAction() {
  const { refresh, setError } = useWallet();
  const { state, setState, lock } = useActionContext();
  const [phase, setPhase] = useState<TxPhase | null>(null);
  const busy =
    state && ["working", "proving", "preparing_transaction", "awaiting_wallet", "submitting", "refreshing"].includes(state.stage)
      ? state.key
      : null;
  const run = useCallback(
    async (
      key: string,
      fn: (setPhase: (p: TxPhase) => void) => Promise<void>,
      opts?: { refresh?: boolean },
    ): Promise<boolean> => {
      if (lock.current || state?.stage === "uncertain") return false;
      lock.current = true;
      const action = trackedAction(window.location.pathname, key);
      if (action) trackEvent("action_started", { action });
      setError(null);
      setState({ key, stage: "working" });
      setPhase(null);
      try {
        await fn((p) => {
          setPhase(p);
          setState({ key, stage: p });
        });
        if (opts?.refresh !== false) {
          setState({ key, stage: "refreshing" });
          await refresh();
        }
        setState({ key, stage: "confirmed" });
        return true;
      } catch (e) {
        const message = errMsg(e);
        const info = transactionError(message);
        if (action && !info.uncertain) trackEvent("action_failed", { action });
        setError(message);
        setState({ key, stage: info.uncertain ? "uncertain" : "failed" });
        return false;
      } finally {
        lock.current = false;
        setPhase(null);
      }
    },
    [refresh, setError, setState, lock, state],
  );
  return { run, busy, phase, uncertain: state?.stage === "uncertain" };
}
