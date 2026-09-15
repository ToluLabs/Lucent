import assert from "node:assert/strict";
import { StateEngine } from "../src/state/engine.ts";
import { MemoryStore } from "../src/state/store.ts";
import { freshState } from "../src/state/types.ts";
import { commit, G, scalarMul } from "../src/crypto/grumpkin.ts";
import { FR_MODULUS } from "../src/crypto/constants.ts";
import { fpAdd, frAdd } from "../src/crypto/field.ts";
import { deriveKeys } from "../src/crypto/keys.ts";
import { buildTransferWitness } from "../src/witness/transfer.ts";

const cursor = (ledger) => `${BigInt(ledger) << 32n}-0`;
const store = new MemoryStore();
const initial = freshState("owner");
initial.cursor = cursor(50);
initial.receiving.v = 3n;
await store.save(initial);
let rpcCalls = 0;
let indexerCalls = 0;
let mode = "fail";
let backfill = [{ type: "deposit", to: "owner", amount: 5n, ledger: 60, cursor: "deposit-60" }];
const keys = deriveKeys(1n, 2n);
const client = {
  cfg: { contracts: { token: "token" } },
  server: {
    getHealth: async () => ({ oldestLedger: 100 }),
    getEvents: async () => {
      rpcCalls++;
      return { events: [], cursor: cursor(200), latestLedger: 200 };
    },
  },
};
const indexer = {
  fetchEvents: async (opts) => {
    indexerCalls++;
    assert.equal(opts.startLedger, 51);
    assert.equal(opts.endLedger, 159);
    if (mode === "fail") throw new Error("temporary outage");
    return { events: backfill, latestLedger: mode === "lag" ? 158 : 200 };
  },
};
const engine = new StateEngine({ client, indexer, store, keys, address: "owner", fromLedger: 1 });
await assert.rejects(engine.sync(), /temporary outage/);
assert.deepEqual(await store.load("owner"), initial);
assert.equal(rpcCalls, 0);
mode = "lag";
await assert.rejects(engine.sync(), /backfill incomplete/);
assert.deepEqual(await store.load("owner"), initial);
assert.equal(rpcCalls, 0);
mode = "ok";
assert.equal((await engine.sync()).receiving.v, 8n);
assert.equal((await engine.sync()).receiving.v, 8n);
assert.equal(indexerCalls, 3, "retry backfill until successful, then resume RPC without replay");

// Real curve arithmetic: a field-modulus sum must not replace the group-order sum.
const r1 = FR_MODULUS - 1n, r2 = FR_MODULUS - 2n;
const mergedPoint = commit(5n, r1).add(commit(7n, r2));
assert(mergedPoint.equals(commit(12n, fpAdd(r1, r2))));
assert(!mergedPoint.equals(commit(12n, frAdd(r1, r2))));
const beforeMerge = { ...initial, spendable: { v: 5n, r: r1 }, receiving: { v: 7n, r: r2 } };
await store.save(beforeMerge);
const optimistic = await engine.applyMerge();
assert(mergedPoint.equals(commit(optimistic.spendable.v, optimistic.spendable.r)));
await store.save(beforeMerge);
backfill = [{ type: "merge", account: "owner", ledger: 60, cursor: "merge-60" }];
const replayed = await engine.sync();
assert.deepEqual(replayed.spendable, optimistic.spendable);

// Receiving credits also use scalar addition, before an eventual merge.
const incoming = buildTransferWitness({ keys: deriveKeys(3n, 2n), v: 5n, r: 0n,
  amount: 2n, pvkB: keys.PVK, kAudR: G, kAudS: G, sigma: 1n, rE: 2n });
await store.save({ ...initial, receiving: { v: 7n, r: r1 } });
backfill = [{ type: "transfer", from: "other", to: "owner", ledger: 60,
  cursor: "transfer-60", ...incoming.payload }];
const credited = await engine.sync();
assert(commit(7n, r1).add(incoming.recipientView.cTx)
  .equals(commit(credited.receiving.v, credited.receiving.r)));
console.log("state-recovery: outage retry, incomplete backfill, no replay, and blinding accumulation passed");
