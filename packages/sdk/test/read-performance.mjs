import { ChainClient } from '../src/chain/client.ts';
import { xdr } from '@stellar/stellar-sdk';
import { performance } from 'node:perf_hooks';
const client = new ChainClient({rpcUrl:'http://localhost:1',networkPassphrase:'test',contracts:{token:'unused'}});
let requests=0;
const wait=()=>new Promise(r=>setTimeout(r,10));
client.server.getAccount=async()=>{requests++;await wait();throw new Error('simulation source absent');};
client.server.simulateTransaction=async()=>{requests++;await wait();return {result:{retval:xdr.ScVal.scvBool(true)}};};
const samples=[];
for (const mode of ['cold','warm']) {
 requests=0;const start=performance.now();
 await Promise.all(Array.from({length:20},()=>client.simulate('CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4','get',[])));
 samples.push({mode,requests,durationMs:Math.round(performance.now()-start)});
}
console.log(JSON.stringify({conditions:'Controlled RPC fixture: 10ms per request; 20 concurrent identical reads; no live network or browser',samples},null,2));
