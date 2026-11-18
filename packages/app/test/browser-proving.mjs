/** Real browser cryptography benchmark; synthetic keys, no wallet or chain submission. */
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile,writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
const app=resolve(import.meta.dirname,'..');const sdk=resolve(app,'../sdk');
const noirRequire=createRequire(realpathSync(resolve(sdk,'node_modules/@noir-lang/noir_js/package.json')));
const wasmFiles=new Map([['/acvm_js_bg.wasm',resolve(dirname(noirRequire.resolve('@noir-lang/acvm_js')),'../web/acvm_js_bg.wasm')],['/noirc_abi_wasm_bg.wasm',resolve(dirname(noirRequire.resolve('@noir-lang/noirc_abi')),'../web/noirc_abi_wasm_bg.wasm')]]);
const mode=process.env.PROOF_MODE??'main';
const all=process.env.PROOF_ALL==='1';
const coreKeys=Object.fromEntries(await Promise.all(['register','transfer','withdraw'].map(async name=>[name,(await readFile(resolve(sdk,'circuits/vks',name+'.vk.bin'))).toString('base64')])));
const disclosureKeys=Object.fromEntries(await Promise.all(['disclose_recipient','disclose_sender'].map(async name=>[name,JSON.parse(await readFile(resolve(sdk,'../disclosure/artifacts',name+'.vk.json'),'utf8')).vkBase64])));
const expectedKeys={...coreKeys,...disclosureKeys};
const proverImport=mode==='worker'
 ? `import {WorkerProver as CircuitProver} from ${JSON.stringify(resolve(app,'lib/worker-prover.ts'))};`
 : `import {CircuitProver,setUltraHonkBackendLoader} from ${JSON.stringify(resolve(sdk,'src/proving/prover.ts'))};`;
const setupBackend=mode==='worker'?'':`setUltraHonkBackendLoader(async()=> (await new Function("return import('/vendor/bb/index.js')")()).UltraHonkBackend);`;
const entry=`${proverImport}
import {deriveKeys} from ${JSON.stringify(resolve(sdk,'src/crypto/keys.ts'))};
import {buildRegisterWitness} from ${JSON.stringify(resolve(sdk,'src/witness/register.ts'))};
import circuit from ${JSON.stringify(resolve(sdk,'circuits/register.json'))};
import withdrawCircuit from ${JSON.stringify(resolve(sdk,'circuits/withdraw.json'))};
import transferCircuit from ${JSON.stringify(resolve(sdk,'circuits/transfer.json'))};
import recipientCircuit from ${JSON.stringify(resolve(sdk,'../disclosure/artifacts/disclose_recipient.json'))};
import senderCircuit from ${JSON.stringify(resolve(sdk,'../disclosure/artifacts/disclose_sender.json'))};
import {buildTransferWitness} from ${JSON.stringify(resolve(sdk,'src/witness/transfer.ts'))};
import {buildWithdrawWitness} from ${JSON.stringify(resolve(sdk,'src/witness/withdraw.ts'))};
import {buildDiscloseRecipientWitness} from ${JSON.stringify(resolve(sdk,'src/witness/disclose-recipient.ts'))};
import {buildDiscloseSenderWitness} from ${JSON.stringify(resolve(sdk,'src/witness/disclose-sender.ts'))};
import {G} from ${JSON.stringify(resolve(sdk,'src/crypto/grumpkin.ts'))};
window.runProof=async()=>{
 ${setupBackend}
 const startedMs=performance.now();const samples=[];
 const keys=deriveKeys(1n,2n),holder=deriveKeys(3n,2n);
 const transfer=buildTransferWitness({keys,v:1000n,r:0n,amount:250n,pvkB:holder.PVK,kAudR:G,kAudS:G});
 const event={rE:transfer.payload.rE,sigma:transfer.payload.sigma,vTilde:transfer.payload.vTilde};
 const cases=[{name:'register',artifact:circuit,inputs:()=>buildRegisterWitness(keys).inputs}];
 if(${all})cases.push(
 {name:'withdraw',artifact:withdrawCircuit,inputs:()=>buildWithdrawWitness({keys,v:1000n,r:0n,amount:100n,kAudS:G}).inputs},
 {name:'transfer',artifact:transferCircuit,inputs:()=>transfer.inputs},
 {name:'disclose_recipient',artifact:recipientCircuit,inputs:()=>buildDiscloseRecipientWitness({keys:holder,event,pR:G,nu:1n}).inputs},
 {name:'disclose_sender',artifact:senderCircuit,inputs:()=>buildDiscloseSenderWitness({keys,rEScalar:transfer.rEScalar,event,pvkB:holder.PVK,pR:G,nu:1n}).inputs});
 for(const test of cases){
  const prover=new CircuitProver(test.artifact);
  try{for(const cache of (test.name==='register'||test.name==='transfer'?['cold-backend','warm-backend']:['cold-backend'])){
   const start=performance.now();const result=await prover.prove(test.inputs());const proveMs=performance.now()-start;
   const check=performance.now();const verified=await prover.verify(result);
   const verifyMs=performance.now()-check;
   const vk=await prover.verificationKey();
   const vkMatches=btoa(String.fromCharCode(...vk))===${JSON.stringify(expectedKeys)}[test.name];
   samples.push({circuit:test.name,cache,proveMs,verifyMs,verified,vkMatches,proofBytes:result.proof.length});
  }}finally{await prover.destroy();}
 }
 return {samples,startedMs,endedMs:performance.now()};
};`;
const bundle=await build({stdin:{contents:entry,resolveDir:app,loader:'js'},bundle:true,write:false,format:'esm',platform:'browser',external:['@aztec/bb.js'],define:{'process.env.NODE_ENV':'"test"'}});
const server=createServer(async(req,res)=>{
 res.setHeader('Cross-Origin-Opener-Policy','same-origin');res.setHeader('Cross-Origin-Embedder-Policy','credentialless');
 try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body><h1>Isolated proof benchmark</h1><script type="module" src="/entry.js"></script></body></html>');}
 else if(path==='/entry.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].contents);}
 else if(wasmFiles.has(path)){res.setHeader('Content-Type','application/wasm');res.end(await readFile(wasmFiles.get(path)));}
 else if(path.startsWith('/vendor/')&&!path.includes('..')){res.setHeader('Content-Type',path.endsWith('.wasm')?'application/wasm':'text/javascript');res.end(await readFile(resolve(app,'public',path.slice(1))));}
 else {res.writeHead(404);res.end();}
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
 const context=await browser.newContext();const page=await context.newPage();page.setDefaultTimeout(180000);
 await page.addInitScript(()=>{window.__tasks=[];new PerformanceObserver(list=>window.__tasks.push(...list.getEntries().map(e=>({startMs:e.startTime,durationMs:e.duration})))).observe({type:'longtask',buffered:true});});
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>typeof window.runProof==='function');
 const {samples,startedMs,endedMs}=await page.evaluate(()=>window.runProof());
 await page.waitForTimeout(50);
 const tasks=await page.evaluate(()=>window.__tasks);
 for(let i=0;i<50&&page.workers().length;i++)await page.waitForTimeout(20);
 const remainingWorkers=page.workers().length;
 if(remainingWorkers!==0)throw Error(`Proof worker cleanup left ${remainingWorkers} workers`);
 const result={mode,remainingWorkers,conditions:'Real Chrome, same native bb.js assets, cross-origin isolation, registration circuit and Keccak transcript; synthetic inputs; no wallet or transaction. Cold backend may use browser/native network caches. One cold/warm pair.',samples,tasks,proofInterval:{startedMs,endedMs},longTasks:tasks.length,maxLongTaskMs:Math.max(0,...tasks.map(t=>t.durationMs)),blockingMs:tasks.reduce((s,t)=>s+Math.max(0,t.durationMs-50),0)};
 if(samples.some(s=>!s.verified||!s.vkMatches))throw Error('Proof verification failed');
 await writeFile(process.env.PERF_REPORT??'/tmp/lucent-browser-proving.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
