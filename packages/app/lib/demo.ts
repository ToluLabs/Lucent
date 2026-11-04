/**
 * Development-only demo mode. Open any page with `?demo=1` and the app runs
 * against a fake connected wallet (balances, activity, payroll, escrow), so
 * every screen can be designed and screenshotted without Freighter or chain
 * access. Compiled out of production builds: `demoEnabled()` is always false
 * there. `?demo=0` leaves demo mode.
 */

import { EscrowState, RunStatus, type ConfidentialEvent, type EscrowInfo } from "@lucent/sdk";
import type { ConfidentialWallet, WalletView } from "./wallet";

const FLAG = "lucent:demo";

export function demoEnabled(): boolean {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("demo");
    if (q === "0") sessionStorage.removeItem(FLAG);
    if (q === "1") sessionStorage.setItem(FLAG, "1");
    return sessionStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

const ME = "GDQPXM4TLKR3NVZB6YHW2ECJF7A5OIU4SGKTD3YQ7MXLB2WZC4EAH9KQ";
const ALICE = "GBX4N7RZP2KQ6TLHD3WYVJ5MEFA8OCU2SIGXT4B7QN3ZLRKW6EYDF2A7";
const BOB = "GCM7TT3BQ9XK4RWL2HNZV6YFEJA5DOU8SGIT3Y7QPMXB2LKZC4WEA9R1";
const CAROL = "GAWEL0X9QJ4TKR3NVZB6YHW2ECMF7A5OIU4SGDT3YQ7XLB2WKC4EZH9P";
const ESCROW = "CDK271PAQJ4TKR3NVZB6YHW2ECMF7A5OIU4SGDT3YQ7XLB2WKC4EZH9P";

export const DEMO_VIEW: WalletView = {
  address: ME,
  registered: true,
  spendable: 128_450_000_000n,
  receiving: 12_500_000_000n,
  syncedLedger: 3_500_000,
  matchesChain: true,
  publicUSDC: 4_200_000_000n,
};

const now = Date.now();
const iso = (minsAgo: number) => new Date(now - minsAgo * 60_000).toISOString();
const base = { ledger: 3_499_000, txHash: "demo".padEnd(64, "0"), closedAt: "" };

function ev(partial: Record<string, unknown>, i: number, minsAgo: number): ConfidentialEvent {
  return { ...base, cursor: `demo-${i}`, closedAt: iso(minsAgo), ledger: base.ledger - i, ...partial } as unknown as ConfidentialEvent;
}

export const DEMO_EVENTS: ConfidentialEvent[] = [
  ev({ type: "transfer", from: ALICE, to: ME }, 1, 4),
  ev({ type: "merge", account: ME }, 2, 22),
  ev({ type: "transfer", from: ME, to: BOB }, 3, 95),
  ev({ type: "transfer", from: ESCROW, to: ME }, 4, 60 * 5),
  ev({ type: "deposit", from: ME, to: ME, amount: 50_000_000_000n }, 5, 60 * 26),
  ev({ type: "transfer", from: CAROL, to: ME }, 6, 60 * 30),
  ev({ type: "transfer", from: ME, to: ESCROW }, 7, 60 * 52),
  ev({ type: "withdraw", from: ME, to: ME, amount: 8_000_000_000n }, 8, 60 * 70),
  ev({ type: "register", account: ME, auditorId: 0 }, 9, 60 * 96),
];

const DEMO_AMOUNTS: Record<string, bigint> = {
  "demo-1": 12_500_000_000n,
  "demo-3": 3_200_000_000n,
  "demo-4": 18_000_000_000n,
  "demo-6": 5_150_000_000n,
  "demo-7": 18_000_000_000n,
};

const sec = (offset: number) => BigInt(Math.floor(now / 1000) + offset);
const ESCROWS: { id: bigint; address: string; info: EscrowInfo }[] = [
  {
    id: 1n,
    address: ESCROW,
    info: { depositor: ME, recipient: ALICE, arbiter: CAROL, state: EscrowState.Funded, createdAt: sec(-86400), timeoutAt: sec(86400 * 6), completedAt: 0n },
  },
  {
    id: 2n,
    address: "CBP4QJ4TKR3NVZB6YHW2ECMF7A5OIU4SGDT3YQ7XLB2WKC4EZH9PA71K",
    info: { depositor: BOB, recipient: ME, arbiter: null, state: EscrowState.Completed, createdAt: sec(-86400 * 3), timeoutAt: sec(86400 * 2), completedAt: sec(-3600) },
  },
  {
    id: 3n,
    address: "CAZ9QJ4TKR3NVZB6YHW2ECMF7A5OIU4SGDT3YQ7XLB2WKC4EZH9PB2MD",
    info: { depositor: ME, recipient: CAROL, arbiter: null, state: EscrowState.Released, createdAt: sec(-86400 * 9), timeoutAt: sec(-86400 * 2), completedAt: sec(-86400 * 4) },
  },
];

const TEMPLATES = [
  { employer: ME, employees: [ALICE, BOB, CAROL], active: true, createdAt: sec(-86400 * 20) },
  { employer: ME, employees: [BOB, CAROL], active: true, createdAt: sec(-86400 * 8) },
];
const RUNS = [
  { templateId: 1n, status: RunStatus.Executed, executedAt: sec(-86400 * 10) },
  { templateId: 1n, status: RunStatus.Funded, executedAt: 0n },
  { templateId: 2n, status: RunStatus.Scheduled, executedAt: 0n },
];

const ok = async () => undefined;
const overrides: Record<string, unknown> = {
  address: ME,
  merge: ok,
  register: ok,
  deposit: ok,
  withdraw: ok,
  transfer: ok,
  refresh: async () => DEMO_VIEW,
  resync: async () => DEMO_VIEW,
  isRecipientRegistered: async () => true,
  canDiscloseSent: () => true,
  decryptOwnTransferAmount: async (e: { cursor: string }) => DEMO_AMOUNTS[e.cursor] ?? null,
  escrowInfo: async (a: string) => ESCROWS.find((x) => x.address === a)?.info ?? ESCROWS[0].info,
  listEscrows: async () => ESCROWS,
  payrollTemplateCount: async () => BigInt(TEMPLATES.length),
  payrollRunCount: async () => BigInt(RUNS.length),
  payrollTemplate: async (id: bigint) => TEMPLATES[Number(id) - 1],
  payrollRun: async (id: bigint) => RUNS[Number(id) - 1],
  createTemplate: async () => 3n,
  createRun: async () => 4n,
  isFrozen: async () => false,
  isAllowed: async () => true,
  complianceConfig: async () => null,
};

/** A stand-in for ConfidentialWallet: known reads return fixtures, anything else resolves to nothing. */
export function createDemoWallet(): ConfidentialWallet {
  return new Proxy({} as Record<string, unknown>, {
    get: (_t, prop: string) => (prop in overrides ? overrides[prop] : ok),
  }) as unknown as ConfidentialWallet;
}
