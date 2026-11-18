/** Build a content-addressed browser proof worker with the pinned Noir WASM companions. */
import { createRequire } from 'node:module';
import { readFile,writeFile,mkdir,copyFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const app=resolve(root,'packages/app');const sdk=resolve(root,'packages/sdk');
const require=createRequire(resolve(app,'package.json'));const {build}=require('esbuild');
const noirRequire=createRequire(realpathSync(resolve(sdk,'node_modules/@noir-lang/noir_js/package.json')));
const wasm=['@noir-lang/acvm_js','@noir-lang/noirc_abi'].map((name,i)=>({
 name:i===0?'acvm_js_bg.wasm':'noirc_abi_wasm_bg.wasm',
 path:resolve(dirname(noirRequire.resolve(name)),'../web',i===0?'acvm_js_bg.wasm':'noirc_abi_wasm_bg.wasm'),
}));
const bundle=await build({entryPoints:[resolve(app,'lib/proof-worker.ts')],bundle:true,write:false,minify:true,format:'esm',platform:'browser',external:['@aztec/bb.js'],define:{'process.env.NODE_ENV':'"production"'}});
const bytes=bundle.outputFiles[0].contents;
const hash=createHash('sha256').update(bytes);
for(const file of wasm)hash.update(await readFile(file.path));
const version=hash.digest('hex').slice(0,20);const destination=resolve(app,'public/vendor/prover',version);
await mkdir(destination,{recursive:true});await writeFile(resolve(destination,'worker.js'),bytes);
for(const file of wasm)await copyFile(file.path,resolve(destination,file.name));
await writeFile(resolve(app,'lib/proof-worker-manifest.json'),JSON.stringify({url:`/vendor/prover/${version}/worker.js`},null,2)+'\n');
console.log('Built isolated proof worker and pinned Noir WASM assets');
