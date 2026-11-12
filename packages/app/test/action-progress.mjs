import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

// Test the real action orchestration with a controllable account refresh.
const phases = [];
const context = {
  state: null,
  lock: { current: false },
  setState(next) { phases.push(next.stage); },
};
let finishRefresh;
globalThis.__lucentActionTest = {
  context,
  wallet: {
    setError() {},
    refresh: () => new Promise((resolve) => { finishRefresh = resolve; }),
  },
};
globalThis.window = { location: { pathname: "/home" } };
const bundle = await build({
  entryPoints: [fileURLToPath(new URL("../lib/use-action.ts", import.meta.url))],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [{
    name: "action-context-fixture",
    setup(b) {
      const modules = {
        react: "export const useCallback=f=>f; export const useState=()=>[null,()=>{}];",
        "./action-context": "export const useActionContext=()=>globalThis.__lucentActionTest.context;",
        "./wallet-context": "export const useWallet=()=>globalThis.__lucentActionTest.wallet;",
        "./analytics": "export const trackEvent=()=>{};export const trackedAction=()=>null;",
      };
      b.onResolve({ filter: /^(react|\.\/(action-context|wallet-context|analytics))$/ }, (args) => ({ path: args.path, namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: modules[args.path] }));
    },
  }],
});
const { useAction } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const action = useAction();
const pending = action.run("register", async (setPhase) => {
  setPhase("proving");
  setPhase("preparing_transaction");
  setPhase("awaiting_wallet");
  setPhase("submitting");
});
await Promise.resolve();
assert.deepEqual(phases, ["working", "proving", "preparing_transaction", "awaiting_wallet", "submitting", "refreshing"]);
assert.equal(context.lock.current, true, "Keep actions locked until balances finish refreshing");
assert.equal(await action.run("duplicate", async () => assert.fail("Duplicate action ran")), false);
finishRefresh();
assert.equal(await pending, true);
assert.equal(phases.at(-1), "confirmed");
assert.equal(context.lock.current, false);
phases.length = 0;
assert.equal(await action.run("register", async () => { throw new Error("User declined"); }), false);
assert.deepEqual(phases, ["working", "failed"]);
assert.equal(context.lock.current, false);
delete globalThis.__lucentActionTest;
delete globalThis.window;
console.log("Action progress passed: wallet approval phases, locked balance refresh, duplicate prevention and declined approval.");
