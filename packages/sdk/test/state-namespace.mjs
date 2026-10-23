import assert from "node:assert/strict";
import { LocalStorageStore } from "../src/state/browser-store.ts";
import { freshState } from "../src/state/types.ts";
const values = new Map();
globalThis.localStorage = { getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value) };
const a = new LocalStorageStore("lucent:state:network-a:token-a:");
const b = new LocalStorageStore("lucent:state:network-a:token-b:");
const c = new LocalStorageStore("lucent:state:network-b:token-a:");
const state = freshState("owner");
state.spendable.v = 123n;
state.cursor = "old-deployment-cursor";
await a.save(state);
assert.deepEqual(await a.load("owner"), state);
assert.equal(await b.load("owner"), null);
assert.equal(await c.load("owner"), null);
console.log("state-namespace: network and token caches stay isolated");
