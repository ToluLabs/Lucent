"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
export type ActionState = {
  key: string;
  hash?: string;
  stage:
    | "working"
    | "proving"
    | "preparing_transaction"
    | "awaiting_wallet"
    | "submitting"
    | "refreshing"
    | "confirmed"
    | "failed"
    | "uncertain";
};
const PENDING_KEY = "lucent:pending-action";
const Context = createContext<{
  state: ActionState | null;
  setState: (s: ActionState | null) => void;
  lock: React.MutableRefObject<boolean>;
} | null>(null);
export function ActionProvider({ children }: { children: ReactNode }) {
  const [state, updateState] = useState<ActionState | null>(null);
  const lock = useRef(false);
  const pendingHash = useRef<string | undefined>(undefined);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(PENDING_KEY);
      if (saved) {
        let hash: string | undefined;
        try {
          const record = JSON.parse(saved);
          if (/^[a-f0-9]{64}$/i.test(record.hash)) hash = record.hash;
        } catch {
          /* legacy marker */
        }
        pendingHash.current = hash;
        updateState({ key: "previous action", stage: "uncertain", hash });
      }
    } catch {
      /* Keep the in-memory guard when storage is unavailable. */
    }
  }, []);
  const setState = useCallback((next: ActionState | null) => {
    if (!next || next.stage === "working") pendingHash.current = undefined;
    if (next?.hash) pendingHash.current = next.hash;
    updateState(next ? { ...next, hash: pendingHash.current } : null);
    try {
      if (
        next &&
        [
          "working",
          "proving",
          "preparing_transaction",
          "awaiting_wallet",
          "submitting",
          "uncertain",
        ].includes(next.stage)
      )
        sessionStorage.setItem(
          PENDING_KEY,
          JSON.stringify({ hash: pendingHash.current }),
        );
      else sessionStorage.removeItem(PENDING_KEY);
    } catch {
      /* No financial data is persisted in this marker. */
    }
  }, []);
  useEffect(() => {
    const submitted = (event: Event) => {
      const { hash } = (event as CustomEvent<{ hash: string }>).detail ?? {};
      if (!/^[a-f0-9]{64}$/i.test(hash)) return;
      if (!lock.current) return;
      pendingHash.current = hash;
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ hash }));
      } catch {}
      updateState((prior) => (prior ? { ...prior, hash } : prior));
    };
    window.addEventListener("lucent:submitted", submitted);
    return () => window.removeEventListener("lucent:submitted", submitted);
  }, []);
  return (
    <Context.Provider value={{ state, setState, lock }}>
      {children}
    </Context.Provider>
  );
}
export function useActionContext() {
  const c = useContext(Context);
  if (!c) throw new Error("Missing ActionProvider");
  return c;
}
