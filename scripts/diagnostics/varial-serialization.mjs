/** Reproduce Varial 5.52.0's SDK serialization failure with synthetic bytes only.
 * Install the isolated upstream SDK as described in the accompanying report.
 * Never attaches to a user's browser, wallet, profile or transaction.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(new URL('../../packages/app/package.json', import.meta.url));
const { build } = require('esbuild');
const { chromium } = require('playwright-core');
const root = resolve(process.env.VARIAL_REPRO_DIR || '/tmp/lucent-wallet-compat');
const sdk = resolve(root, 'node_modules/@stellar/stellar-sdk');
assert.equal(JSON.parse(await readFile(resolve(sdk, 'package.json'), 'utf8')).version, '17.4.0');
const sizes = [1, 2, 3, 16382, 16383, 16384, 32768, 49152, 60000, 65534, 65535, 65536, 98304, 131000, 1000000];
const encoder = resolve(sdk, 'lib/esm/xdr/values/xdr-value.js');
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const report = { sdk: '17.4.0', context: 'Disposable Chrome dedicated worker; synthetic bytes; no wallet, keys or transactions', results: [] };
try {
  const page = await browser.newPage();
  for (const patched of [false, true]) {
    const bundle = await build({
      stdin: { contents: `import {encodeBytes} from ${JSON.stringify(encoder)};
        self.onmessage=()=>{const samples=[];for(const bytes of ${JSON.stringify(sizes)}){
          try{const input=Uint8Array.from({length:bytes},(_,i)=>(i*17+3)%256);
            const encoded=encodeBytes(input,'base64');const decoded=atob(encoded);
            const identical=decoded.length===bytes && input.every((v,i)=>v===decoded.charCodeAt(i));
            samples.push({bytes,ok:identical});
          }catch(e){samples.push({bytes,ok:false,error:e.name+': '+e.message});}
        }self.postMessage(samples);};`, resolveDir: root },
      bundle: true, write: false, platform: 'browser', format: 'iife',
      plugins: patched ? [{ name: 'isolated-upstream-patch', setup(b) {
        b.onLoad({ filter: /base\/util\/base64\.js$/ }, async args => {
          const source = await readFile(args.path, 'utf8');
          assert(source.includes('const ENCODE_CHUNK_SIZE = 65535;'));
          return { contents: source.replace('const ENCODE_CHUNK_SIZE = 65535;', 'const ENCODE_CHUNK_SIZE = 16383;'), loader: 'js' };
        });
      } }] : [],
    });
    const samples = await page.evaluate(code => new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
      const worker = new Worker(url);
      const timeout = setTimeout(() => { worker.terminate(); URL.revokeObjectURL(url); reject(Error('Worker test timed out')); }, 30000);
      worker.onmessage = e => { clearTimeout(timeout); worker.terminate(); URL.revokeObjectURL(url); resolve(e.data); };
      worker.onerror = () => { clearTimeout(timeout); worker.terminate(); URL.revokeObjectURL(url); reject(Error('Worker test failed')); };
      worker.postMessage('test');
    }), bundle.outputFiles[0].text);
    if (patched) assert(samples.every(s => s.ok), 'Patched encoder must round-trip every payload byte');
    report.results.push({ patched, samples });
  }
} finally { await browser.close(); }
const text = JSON.stringify(report, null, 2);
if (process.env.PERF_REPORT) await writeFile(resolve(process.env.PERF_REPORT), text+'\n');
console.log(text);
