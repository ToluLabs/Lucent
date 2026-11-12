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
  useEffect(() => {
    try {
      if (sessionStorage.getItem(PENDING_KEY))
        updateState({ key: "previous action", stage: "uncertain" });
    } catch {
      /* Keep the in-memory guard when storage is unavailable. */
    }
  }, []);
  const setState = useCallback((next: ActionState | null) => {
    updateState(next);
    try {
      if (
        next &&
        ["working", "proving", "preparing_transaction", "awaiting_wallet", "submitting", "uncertain"].includes(next.stage)
      )
        sessionStorage.setItem(PENDING_KEY, "1");
      else sessionStorage.removeItem(PENDING_KEY);
    } catch {
      /* No financial data is persisted in this marker. */
    }
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
