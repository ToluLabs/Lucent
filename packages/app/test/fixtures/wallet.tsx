import { createContext, useContext, useMemo, useRef, useState } from "react";
import type { ConfidentialWallet } from "../../lib/wallet";
const A = "GARPOFVYCDHGS76WT7QVPMRNL23I3DJV4W2VLOXDULF3XG4BGCOFNA3Q";
export const B = "GBEYGMUUNP42QQRWZBKHAGNURZFE76ASFJ5QUEHA5UAXNEQFYCAKBQWO";
const C = createContext<any>(null);
const settings = () => new URLSearchParams(location.search);
export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(
    settings().get("state") !== "disconnected",
  );
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [templateCreated, setTemplateCreated] = useState(false);
  const current = useRef({ paid, templateCreated });
  current.current = { paid, templateCreated };
  const wallet = useMemo(() => {
    const operation = async (phase?: (p: string) => void) => {
      (window as any).__calls = ((window as any).__calls ?? 0) + 1;
      phase?.("proving");
      await new Promise((r) => setTimeout(r, 80));
      phase?.("submitting");
      await new Promise((r) => setTimeout(r, 120));
      const result = settings().get("result");
      if (result === "declined")
        throw new Error("User declined wallet approval");
      if (result === "timeout")
        throw new Error(
          `transfer confirmation timed out (tx ${"a".repeat(64)})`,
        );
      setPaid(true);
    };
    return {
      address: A,
      listEvents: async () => {
        (window as any).__historyCalls =
          ((window as any).__historyCalls ?? 0) + 1;
        if (settings().has("historyError"))
          throw new Error("RPC history unavailable");
        return [];
      },
      isRecipientRegistered: async (_address: string) => {
        await new Promise((r) => setTimeout(r, 40));
        if (settings().has("rpcError")) throw new Error("RPC unavailable");
        return !settings().has("unregisteredRecipient");
      },
      transfer: async (_to: string, _amount: bigint, phase: any) => {
        await operation(phase);
        return { hash: "b".repeat(64) };
      },
      deposit: () => operation(),
      withdraw: (_amount: bigint, phase: any) => operation(phase),
      merge: () => operation(),
      register: (phase: any) => operation(phase),
      claimSalary: () => operation(),
      payrollTemplateCount: async () =>
        current.current.templateCreated ? 2n : 1n,
      payrollRunCount: async () => 2n,
      payrollTemplate: async () => ({
        employer: A,
        employees: [B],
        active: true,
      }),
      payrollRun: async (id: bigint) => ({
        templateId: 1n,
        status: id === 1n ? 0 : current.current.paid ? 2 : 1,
      }),
      createTemplate: async () => {
        await operation();
        setTemplateCreated(true);
        return 2n;
      },
      createRun: async () => {
        await operation();
        return 3n;
      },
      fundRun: () => operation(),
      cancelRun: () => operation(),
      executeRun: (_id: bigint, _payments: any, phase: any) => operation(phase),
      listEscrows: async () =>
        settings().has("empty")
          ? []
          : [
              {
                id: 1n,
                address: "C" + "A".repeat(55),
                info: {
                  depositor: A,
                  recipient: B,
                  arbiter: null,
                  state: 0,
                  timeoutAt: 0n,
                  completedAt: 0n,
                },
              },
            ],
      createEscrow: async () => {
        await operation();
        return { id: 2n, address: "C" + "B".repeat(55) };
      },
      fundEscrow: (
        _address: string,
        _recipient: string,
        _amount: bigint,
        phase: any,
      ) => operation(phase),
      cancelEscrow: () => operation(),
      canDiscloseSent: () => false,
      decryptOwnTransferAmount: async () => 5000000n,
      complianceConfig: async () => ({ policy: null }),
      isAllowed: async () => true,
      isFrozen: async () => false,
    } as unknown as ConfidentialWallet;
  }, []);
  const state = settings().get("state");
  const view =
    state === "unknown"
      ? null
      : {
          registered: state !== "unregistered",
          matchesChain: state !== "mismatch",
          spendable: 1234567890n,
          receiving: 10000000n,
          publicUSDC: 50000000n,
        };
  return (
    <C.Provider
      value={{
        wallet: connected ? wallet : null,
        view: connected ? view : null,
        error,
        setError,
        connecting: false,
        connect: async () => {
          setConnected(true);
          return wallet;
        },
        disconnect: () => setConnected(false),
        refresh: async () => {},
        resync: async () => {},
        lastSync: null,
        logs: [],
        log: () => {},
      }}
    >
      {children}
    </C.Provider>
  );
}
export function useWallet(): any {
  return useContext(C);
}
