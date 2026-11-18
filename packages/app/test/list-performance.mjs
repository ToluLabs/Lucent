import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { mapConcurrent } from '../lib/concurrent.ts';
const samples=[];
for(const latencyMs of [5,50]) {
 const items=Array.from({length:24},(_,i)=>i);
 const load=async i=>{await new Promise(r=>setTimeout(r,latencyMs));return i;};
 const start=performance.now();const before=[];
 for(const i of items)before.push(await load(i));
 const serialMs=performance.now()-start;
 const next=performance.now();const after=await mapConcurrent(items,load);
 const boundedMs=performance.now()-next;
 assert.deepEqual(before,after);
 samples.push({latencyMs,items:items.length,requestsBefore:24,requestsAfter:24,serialMs,boundedMs});
}
console.log(JSON.stringify({conditions:'Controlled independent-read fixture, identical 24 records, sequential baseline versus four-worker bounded fan-out. Not live RPC or browser.',samples},null,2));
