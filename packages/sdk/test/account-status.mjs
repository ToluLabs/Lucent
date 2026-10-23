import assert from "node:assert/strict";
import { ChainClient } from "../src/chain/client.ts";
import { G, pointToBytes } from "../src/crypto/grumpkin.ts";
import { xdr, nativeToScVal } from "@stellar/stellar-sdk";

const client = new ChainClient({ rpcUrl: "https://example.com", networkPassphrase: "test", contracts: { token: "token" } });
const address = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
const absent = new Error("simulate confidential_balance failed: HostError: Error(Contract, #3501)\nEvent log");
client.simulate = async () => { throw absent; };
assert.equal(await client.confidentialBalance(address), null);
assert.equal(await client.isRegistered(address), false);

for (const error of [new Error("network unavailable"), new Error("simulate confidential_balance failed: HostError: Error(Storage, MissingValue)"), { code: -32603, message: "RPC unavailable" }]) {
  client.simulate = async () => { throw error; };
  await assert.rejects(client.confidentialBalance(address), e => e === error);
}
client.simulate = async () => xdr.ScVal.scvVoid();
await assert.rejects(client.confidentialBalance(address));

const point = () => nativeToScVal(Buffer.from(pointToBytes(G)), { type: "bytes" });
client.simulate = async () => xdr.ScVal.scvMap([
  ...["spending_key", "viewing_public_key", "spendable_balance", "receiving_balance"].map(key => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(key), val: point() })),
  new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("auditor_id"), val: xdr.ScVal.scvU32(0) }),
]);
assert.equal(await client.isRegistered(address), true);
assert((await client.confidentialBalance(address)).spendingKey.equals(G));
console.log("account-status: registered, absent, RPC failure, archived data, and malformed response passed");
