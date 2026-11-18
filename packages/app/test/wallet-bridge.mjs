import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

// Exercise the installed API's real postMessage transport, not a mocked API.
const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL('../lib/freighter.ts', import.meta.url))],
  bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'adapter',
});
const address = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const listeners = new Set();
const requests = [];
let rejection = false;
let signerAddress = address;
const window = {
  freighter: true, location: { origin: 'http://localhost:3000' },
  addEventListener(type, callback) { if (type === 'message') listeners.add(callback); },
  removeEventListener(type, callback) { listeners.delete(callback); },
  postMessage(request) {
    requests.push(request);
    queueMicrotask(() => {
      let payload = {};
      if (request.type === 'REQUEST_NETWORK_DETAILS') payload = { networkDetails: {
        network: 'TESTNET', networkUrl: 'https://horizon-testnet.stellar.org',
        networkPassphrase: 'Test SDF Network ; September 2015',
      } };
      if (request.type === 'REQUEST_ACCESS') payload = { publicKey: address };
      if (request.type === 'SUBMIT_TRANSACTION') payload = rejection
        ? { apiError: { code: -4, message: 'The user rejected this request.' } }
        : { signedTransaction: 'signed-fixture', signerAddress };
      const event = { source: window, data: { source: 'FREIGHTER_EXTERNAL_MSG_RESPONSE',
        messagedId: request.messageId, ...payload } };
      for (const listener of [...listeners]) listener(event);
    });
  },
};
const context = vm.createContext({ window, console, setTimeout, clearTimeout, atob, Uint8Array, process: { env: {} } });
vm.runInContext(outputFiles[0].text, context);
const signer = await context.adapter.connectFreighter();
assert.equal(await signer.sign('unsigned-fixture'), 'signed-fixture');
const signingRequests = () => requests.filter(r => r.type === 'SUBMIT_TRANSACTION');
assert.equal(signingRequests()[0].accountToSign, address, 'Installed API must receive the intended signing account');
assert.equal(signingRequests()[0].networkPassphrase, 'Test SDF Network ; September 2015');
rejection = true;
await assert.rejects(signer.sign('unsigned-fixture'), /code -4/);
assert.equal(signingRequests().length, 2, 'Never retry rejection automatically');
rejection = false;
signerAddress = 'wrong-account';
await assert.rejects(signer.sign('unsigned-fixture'), /different account/);
assert.equal(listeners.size, 0);
console.log('Wallet bridge: real installed API forwards account/network; rejection is not retried; wrong signer rejected.');
