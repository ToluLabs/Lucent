import assert from 'node:assert/strict';
import {Account, Contract, SorobanDataBuilder, xdr} from '@stellar/stellar-sdk';
import {ChainClient} from '../src/chain/client.ts';
const address='GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const contract='CACKEFUKVPBGDJM6Z4NOTY3H44MUMJDYIRNBLH6MDFN3QUSFWENXAABF';
const key=new Contract(contract).getFootprint();
const client=new ChainClient({rpcUrl:'https://example.com',networkPassphrase:'test',contracts:{token:contract}});
client.server.getTransaction=async()=>({status:'NOT_FOUND',latestLedgerCloseTime:Math.floor(Date.now()/1000)});
client.server.getLedgerEntries=async()=>({entries:[{val:{configSetting:()=>({contractLedgerCost:()=>({txMaxWriteBytes:()=>132096})})}}]});
let simulations=0, accounts=0;
const submissions=[];
client.server.getAccount=async()=>new Account(address,String(++accounts));
client.server.simulateTransaction=async tx=>{
 simulations++;
 const data=new SorobanDataBuilder().setReadWrite([key]).build();
 if(simulations===1) data.ext(new xdr.SorobanTransactionDataExt(1,new xdr.SorobanResourcesExtV0({archivedSorobanEntries:[0]})));
 if(simulations===2) {
  assert.equal(tx.operations[0].type,'restoreFootprint');
  assert.equal(tx.toEnvelope().v1().tx().ext().value().resources().footprint().readWrite().length,1);
 }
 return {_parsed:true, latestLedger:1,events:[],transactionData:new SorobanDataBuilder(data),minResourceFee:'0',result:{auth:[],retval:xdr.ScVal.scvVoid()}};
};
client.submit=async(tx,signer,method)=>{
 submissions.push({method,sequence:tx.sequence});
 return {hash:'test',status:'SUCCESS'};
};
await client.invoke(contract,'register',[],{publicKey:address});
assert.equal(simulations,3);
assert.deepEqual(submissions.map(x=>x.method),['restore for register','register']);
assert.notEqual(submissions[0].sequence,submissions[1].sequence);
console.log('restore: separate restoration, fresh simulation, fresh sequence, then invocation passed');

// The failing live batch declared 141228 write bytes against a 132096 limit.
const keys = [key, xdr.LedgerKey.contractCode(new xdr.LedgerKeyContractCode({hash:Buffer.alloc(32,1)})), xdr.LedgerKey.contractCode(new xdr.LedgerKeyContractCode({hash:Buffer.alloc(32,2)}))];
function setup({singleTooLarge=false, failSecond=false, simulationError=false}={}) {
 const c=new ChainClient({rpcUrl:'http://localhost:1',networkPassphrase:'test',contracts:{token:contract}});
 let sequence=0, invoked=0;
 const sent=[];
 c.server.getAccount=async()=>new Account(address,String(++sequence));
 c.server.getTransaction=async()=>({status:'NOT_FOUND',latestLedgerCloseTime:Math.floor(Date.now()/1000)});
 c.server.getLedgerEntries=client.server.getLedgerEntries;
 c.server.simulateTransaction=async tx=>{
  let data;
  if(tx.operations[0].type==='restoreFootprint') {
   const batch=tx.toEnvelope().v1().tx().ext().sorobanData().resources().footprint().readWrite();
   if(simulationError && batch.length>1) return {error:'transaction resources exceed network config limit'};
   const bytes=singleTooLarge?141228:batch.length>1?141228:70000;
   data=new SorobanDataBuilder().setReadWrite(batch).setResources(0,0,bytes).build();
  } else {
   invoked++;
   data=new SorobanDataBuilder().setReadWrite(keys).build();
   if(invoked===1) data.ext(new xdr.SorobanTransactionDataExt(1,new xdr.SorobanResourcesExtV0({archivedSorobanEntries:[0,1,2]})));
   else assert.equal(sent.length,3,'Payroll only prepared again after every restoration confirms');
  }
  return {_parsed:true,latestLedger:1,events:[],transactionData:new SorobanDataBuilder(data),minResourceFee:'0',result:{auth:[],retval:xdr.ScVal.scvVoid()}};
 };
 c.submit=async(tx,signer,method)=>{
  if(failSecond && sent.length===1) throw Error('Wallet rejected second restore');
  const bytes=tx.toEnvelope().v1().tx().ext().sorobanData().resources().writeBytes();
  assert(bytes<=132096,'Never request signature for an oversized restore');
  sent.push({method,sequence:tx.sequence});
  return {hash:'test',status:'SUCCESS'};
 };
 return {c,sent,get invoked(){return invoked;}};
}
for(const simulationError of [false,true]) {
 const f=setup({simulationError});
 await f.c.invoke(contract,'execute_run',[],{publicKey:address});
 assert.deepEqual(f.sent.map(s=>s.method),['restore for execute_run','restore for execute_run','restore for execute_run','execute_run']);
 assert.equal(new Set(f.sent.map(s=>s.sequence)).size,4,'Each submitted transaction uses a fresh sequence');
}
const oversized=setup({singleTooLarge:true});
await assert.rejects(oversized.c.invoke(contract,'execute_run',[],{publicKey:address}),/single archived entry exceeds/);
assert.equal(oversized.sent.length,0);
const cancelled=setup({failSecond:true});
await assert.rejects(cancelled.c.invoke(contract,'execute_run',[],{publicKey:address}),/Wallet rejected second restore/);
assert.equal(cancelled.sent.length,1);
assert.equal(cancelled.invoked,1,'Cancellation never invokes payroll again or retries submission');
console.log('restore batches: dynamic network limit, oversized simulation/simulation error splitting, fresh sequences, unsplittable entry and cancellation passed');
