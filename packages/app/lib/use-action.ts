"use client";
import { useCallback, useState } from "react";
import { useActionContext } from "./action-context";
import { transactionError } from "./action-result";
import { trackEvent, trackedAction } from "./analytics";
import { errMsg } from "./err";
import type { TxPhase } from "./wallet";
import { useQueryClient } from "@tanstack/react-query";
import { publicScope } from "./public-query";
import { useWallet } from "./wallet-context";
export function useAction() {
  const { wallet, refresh, setError } = useWallet();
  const queries = useQueryClient();
  const { state, setState, lock } = useActionContext();
  const [phase, setPhase] = useState<TxPhase | null>(null);
  const busy =
    state &&
    [
      "working",
      "proving",
      "preparing_transaction",
      "awaiting_wallet",
      "submitting",
      "refreshing",
    ].includes(state.stage)
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
      const path = window.location.pathname;
      const action = trackedAction(path, key);
      if (action) trackEvent("action_started", { action });
      setError(null);
      setState({ key, stage: "working" });
      setPhase(null);
      try {
        await fn((p) => {
          setPhase(p);
          setState({ key, stage: p });
        });
        // Only reached after the action has confirmed; pending/failed actions never invalidate.
        if (wallet) {
          const resources =
            path === "/escrow"
              ? ["activity", "escrows", "escrow", "public-balance"]
              : path === "/payroll"
                ? ["activity", "payroll", "public-balance"]
                : ["activity", "public-balance", "recipient"];
          void queries.invalidateQueries({
            predicate: (q) => {
              const scope = publicScope(wallet.address);
              return (
                scope.every((part, i) => q.queryKey[i] === part) &&
                resources.includes(String(q.queryKey[scope.length]))
              );
            },
          });
        }
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
        setState({
          key,
          stage: info.uncertain ? "uncertain" : "failed",
          hash: info.hash,
        });
        return false;
      } finally {
        lock.current = false;
        setPhase(null);
      }
    },
    [wallet, queries, refresh, setError, setState, lock, state],
  );
  return { run, busy, phase, uncertain: state?.stage === "uncertain" };
}
