import assert from 'node:assert/strict';
import {Account, Contract, SorobanDataBuilder, xdr} from '@stellar/stellar-sdk';
import {ChainClient} from '../src/chain/client.ts';
const address='GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
const contract='CACKEFUKVPBGDJM6Z4NOTY3H44MUMJDYIRNBLH6MDFN3QUSFWENXAABF';
const key=new Contract(contract).getFootprint();
const client=new ChainClient({rpcUrl:'https://example.com',networkPassphrase:'test',contracts:{token:contract}});
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
