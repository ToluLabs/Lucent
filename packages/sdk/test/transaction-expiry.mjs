import assert from 'node:assert/strict';
import { Account, Contract, Keypair, SorobanDataBuilder, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { ChainClient } from '../src/chain/client.ts';
const kp=Keypair.random();const contract='CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
const data=new SorobanDataBuilder().setResourceFee('1234').build();
const original=new TransactionBuilder(new Account(kp.publicKey(),'4'),{fee:'5000',networkPassphrase:'test'})
 .addOperation(new Contract(contract).call('test')).setSorobanData(data).setTimeout(180).build();
for(const offset of [-7*3600,7*3600]) {
 const ledgerTime=Math.floor(Date.now()/1000)+offset;
 const c=new ChainClient({rpcUrl:'http://localhost:1',networkPassphrase:'test',contracts:{token:contract}});
 let sent=0,clockCalls=0;
 c.server.getTransaction=async hash=>{if(hash==='0'.repeat(64)){clockCalls++;return {status:'NOT_FOUND',latestLedgerCloseTime:ledgerTime};}return {status:'SUCCESS'};};
 c.server.sendTransaction=async tx=>{sent++;assert(Number(tx.timeBounds.maxTime)>ledgerTime);return {status:'PENDING',hash:'a'.repeat(64)};};
 const signer={publicKey:kp.publicKey(),sign:async encoded=>{
  const tx=TransactionBuilder.fromXDR(encoded,'test');
  assert.equal(Number(tx.timeBounds.maxTime),ledgerTime+300,'Validity must use ledger time, not device time');
  assert.equal(tx.fee,original.fee);assert.equal(tx.sequence,original.sequence);
  assert.equal(tx.operations.length,1);
  assert.equal(tx.toEnvelope().v1().tx().ext().sorobanData().toXDR('base64'),data.toXDR('base64'),'Preserve all Soroban resources/fees');
  return encoded;
 }};
 await c.submit(original,signer,'transfer');assert.equal(sent,1);assert.equal(clockCalls,1);
 // A delayed wallet response cannot cause submission of an expired signed transaction.
 await assert.rejects(c.submit(original,{publicKey:kp.publicKey(),sign:async encoded=>{
  c.clock={seconds:ledgerTime+1000,monotonicMs:performance.now()};return encoded;
 }},'transfer'),/expired before submission/);
 assert.equal(sent,1,'Expired envelope must never reach sendTransaction; no automatic retry');
}
const c=new ChainClient({rpcUrl:'http://localhost:1',networkPassphrase:'test',contracts:{token:contract}});
c.server.getTransaction=async()=>({status:'NOT_FOUND',latestLedgerCloseTime:0});
await assert.rejects(c.submit(original,{publicKey:kp.publicKey(),sign:async()=>assert.fail('Do not open wallet without trustworthy ledger time')},'transfer'),/ledger time unavailable/);
console.log('Transaction expiry: +/-7h device skew, fresh five-minute ledger bounds, Soroban data/fees/sequence preservation, delayed approval and missing ledger clock passed.');

c.server.getTransaction=async()=>{throw new Error('fetch failed');};
await assert.rejects(c.submit(original,{publicKey:kp.publicKey(),sign:async()=>assert.fail('No wallet request after clock lookup failure')},'transfer'),/ledger time unavailable.*Nothing was submitted/);
