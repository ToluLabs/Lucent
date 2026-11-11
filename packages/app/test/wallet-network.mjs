import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

// Exercise the real wallet adapter with a simulated extension, without prompts.
const state = { networkPassphrase: "Public Global Stellar Network ; September 2015", access: 0, signatures: 0 };
globalThis.__lucentWalletTest = state;
const result = await build({
  entryPoints: [fileURLToPath(new URL("../lib/freighter.ts", import.meta.url))],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [{
    name: "mock-extension",
    setup(b) {
      b.onResolve({ filter: /^@stellar\/freighter-api$/ }, () => ({ path: "extension", namespace: "mock" }));
      b.onLoad({ filter: /.*/, namespace: "mock" }, () => ({ contents: `
        const s = globalThis.__lucentWalletTest;
        export async function isConnected(){return {isConnected:true};}
        export async function isAllowed(){return {isAllowed:true};}
        export async function getNetworkDetails(){return s.error?{error:s.error}:{networkPassphrase:s.networkPassphrase};}
        export async function requestAccess(){s.access++;return {address:'test-address'};}
        export async function signTransaction(){s.signatures++;return {signedTxXdr:'signed'};}
        export async function signMessage(){s.signatures++;return {signerAddress:'test-address',signedMessage:'AA=='};}
      ` }));
    },
  }],
});
const { connectFreighter } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
await assert.rejects(connectFreighter(), /Switch Varial to Stellar Testnet/);
assert.equal(state.access, 0, "Mainnet is rejected before requesting access");
state.error = "Wallet locked";
await assert.rejects(connectFreighter(), /Could not read Varial network/);
assert.equal(state.access, 0);
delete state.error;
state.networkPassphrase = "Test SDF Network ; September 2015";
const signer = await connectFreighter();
assert.equal(await signer.sign("transaction"), "signed");
assert.deepEqual(await signer.signMessage("derive keys"), new Uint8Array([0]));
assert.equal(state.signatures, 2);
state.networkPassphrase = "Public Global Stellar Network ; September 2015";
await assert.rejects(signer.sign("transaction"), /Switch Varial to Stellar Testnet/);
await assert.rejects(signer.signMessage("derive keys"), /Switch Varial to Stellar Testnet/);
assert.equal(state.signatures, 2, "Switching to Mainnet blocks both signature methods");
delete globalThis.__lucentWalletTest;
console.log("Wallet network checks passed: Mainnet and unreadable networks blocked; Testnet allowed; network switches block signing.");
