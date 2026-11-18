import assert from 'node:assert/strict';
import { WorkerProver } from '../lib/worker-prover.ts';
class FakeWorker {
 messages=[];terminated=0;
 postMessage(message){this.messages.push(message);if(message.method==='init')queueMicrotask(()=>this.reply(message.id,true,true));}
 reply(id,ok,result){this.onmessage({data:{id,ok,result}});}
 terminate(){this.terminated++;}
}
const fake=new FakeWorker();const prover=new WorkerProver({},()=>fake);await prover.ready;
const a=prover.prove({synthetic:'private-placeholder'});await Promise.resolve();const request=fake.messages.at(-1);
const proof={proof:new Uint8Array([1,2]),publicInputs:[]};fake.reply(request.id,true,proof);assert.equal(await a,proof);
const bad=prover.prove({});await Promise.resolve();fake.reply(fake.messages.at(-1).id,false,'SECRET MUST NOT LEAK');await assert.rejects(bad,e=>!e.message.includes('SECRET')&&e.message.includes('failed'));
const pending=prover.prove({});await Promise.resolve();await prover.destroy();await assert.rejects(pending,/session ended/);assert.equal(fake.terminated,1);
await assert.rejects(prover.prove({}),/session ended/);
const other=new FakeWorker();const crashed=new WorkerProver({},()=>other);await crashed.ready;
const awaiting=crashed.verificationKey();await Promise.resolve();other.onerror();await assert.rejects(awaiting,/worker failed/);assert.equal(other.terminated,1);
const initializing = new FakeWorker();initializing.postMessage=function(message){this.messages.push(message);};
let closed=0;
const interrupted=new WorkerProver({},()=>initializing,()=>{closed++;});
const rejected=assert.rejects(interrupted.ready,/session ended/);
await interrupted.destroy();await rejected;assert.equal(initializing.terminated,1);assert.equal(closed,1);
console.log('Proof worker: response identity, sanitized errors, disconnect cancellation, shutdown and worker crash handling passed.');
