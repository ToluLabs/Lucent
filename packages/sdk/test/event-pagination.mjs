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
