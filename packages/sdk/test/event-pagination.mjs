import assert from "node:assert/strict";
import { xdr, Address, Keypair, nativeToScVal } from "@stellar/stellar-sdk";
import { fetchEvents, resolveEventRef, naturalEventId } from "../src/chain/events.ts";
const ledger = 100;
const cursor = (i) => `${BigInt(ledger) << 32n}-${i}`;
const address = Keypair.random().publicKey();
const event = (i) => ({
  id: cursor(i), ledger, txHash: "tx", topic: [xdr.ScVal.scvSymbol("deposit"),
    new Address(address).toScVal(), new Address(address).toScVal()],
  value: xdr.ScVal.scvMap([new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("amount"),
    val: nativeToScVal(1n, { type: "i128" }) })]),
});
let calls = 0;
const client = { cfg: { contracts: { token: "token" } }, server: {
  getEvents: async (req) => {
    calls++;
    return req.cursor ? { events: [event(201)], cursor: cursor(202), latestLedger: ledger }
      : { events: Array.from({ length: req.limit }, (_, i) => event(i)), cursor: cursor(200), latestLedger: ledger };
  },
}};
const result = await fetchEvents(client, { startLedger: ledger, pageLimit: 200 });
assert.equal(result.events.length, 201);
assert.equal(calls, 2);
calls = 0;
const resolved = await resolveEventRef(client, { ledger, txHash: "tx",
  id: naturalEventId({ ledger, txHash: "tx", opIndex: 0, eventIndex: 201 }) });
assert.equal(resolved?.amount, 1n);
assert.equal(calls, 2);
console.log("event-pagination: full head-ledger pages and disclosure lookup passed");

const rangeError = new Error("startLedger must be within the ledger range: 100 - 200 (code -32600)");
let rangeCalls = 0;
await assert.rejects(fetchEvents({ cfg: client.cfg, server: { getEvents: async () => {
  rangeCalls++;
  throw rangeError;
} } }, { startCursor: "1-0" }), (error) => {
  assert.match(error.message, /Preserve browser storage/);
  assert.match(error.message, /100 - 200/);
  assert.equal(error.cause, rangeError);
  return true;
});
assert.equal(rangeCalls, 1, "Never silently skip missing history or retry from a newer cursor");
console.log("event-range: actionable error preserves RPC cause and does not skip history");
