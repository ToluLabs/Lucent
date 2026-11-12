/** Real Testnet escrow release/refund regression; no production network or wallet secrets in output. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { Address, Asset, BASE_FEE, Keypair, Operation, TransactionBuilder, rpc, scValToNative, nativeToScVal } from "@stellar/stellar-sdk";
import { ChainClient, keypairSigner, type Signer } from "../packages/sdk/src/chain/client.js";
import { deriveKeys } from "../packages/sdk/src/crypto/keys.js";
import { addressToField } from "../packages/sdk/src/crypto/address.js";
import { randomScalar } from "../packages/sdk/src/crypto/field.js";
import { CircuitProver } from "../packages/sdk/src/proving/prover.js";
import { loadCircuit } from "../packages/sdk/src/proving/artifacts.js";
import { buildRegisterWitness } from "../packages/sdk/src/witness/register.js";
import { buildTransferWitness } from "../packages/sdk/src/witness/transfer.js";
import { buildWithdrawWitness } from "../packages/sdk/src/witness/withdraw.js";
import { submitRegister, submitDeposit, submitMerge, submitWithdraw } from "../packages/sdk/src/chain/contract.js";
import { encodeRegisterData, encodeTransferData } from "../packages/sdk/src/chain/payload.js";
import { submitCreateEscrow, parseCreatedEscrow, submitPrepareFunding, submitStorePayoutProof, submitFund, submitMarkCompleted, submitRelease, submitTimeout, readEscrow } from "../packages/sdk/src/chain/escrow.js";
import { StateEngine, MemoryStore } from "../packages/sdk/src/state/index.js";
import { APP_DEPLOYMENT, publicKey, friendbotFund } from "./_shared.js";

async function main() {
  const d = JSON.parse(readFileSync(APP_DEPLOYMENT, "utf8"));
  assert.equal(d.passphrase, "Test SDF Network ; September 2015");
  assert.equal(d.rpcUrl, "https://soroban-testnet.stellar.org");
  const c = new ChainClient({ rpcUrl: d.rpcUrl, networkPassphrase: d.passphrase, contracts: d.contracts });
  const source = process.env.STELLAR_ESCROW_SOURCE ?? "admin";
  const admin = publicKey(source);
  // CLI signs locally; its identity secret never enters this process or output.
  const funder: Signer = { publicKey: admin, async sign(xdr) {
    return execFileSync("stellar", ["tx", "sign", "--sign-with-key", source, "--network", "testnet"], { input: xdr, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } };
  const addr = (a: string) => new Address(a).toScVal();
  const balance = async (a: string) => scValToNative(await c.simulate(d.contracts.underlying, "balance", [addr(a)])) as bigint;
  const initialPublic = await balance(admin);
  const deposit = 1_000_000n; // 0.1 USDC, returned to the funding identity after success.
  assert(initialPublic >= deposit, "CLI funding identity needs 0.1 test USDC");
  const kp = Keypair.random();
  const me = kp.publicKey();
  const signer = keypairSigner(kp.secret(), d.passphrase);
  const fromLedger = await c.latestLedger();
  await friendbotFund(me);
  console.log(`test account = ${me}`);
  const assetName = scValToNative(await c.simulate(d.contracts.underlying, "name", [])) as string;
  const [code, issuer] = assetName.split(":");
  assert.equal(code, "USDC");
  const trust = new TransactionBuilder(await c.server.getAccount(me), { fee: BASE_FEE, networkPassphrase: d.passphrase })
    .addOperation(Operation.changeTrust({ asset: new Asset(code, issuer) })).setTimeout(180).build();
  trust.sign(kp);
  const sent = await c.server.sendTransaction(trust);
  assert.notEqual(sent.status, "ERROR", "Trustline transaction rejected");
  let trusted = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const tx = await c.server.getTransaction(sent.hash);
    if (tx.status === rpc.Api.GetTransactionStatus.NOT_FOUND) continue;
    assert.equal(tx.status, rpc.Api.GetTransactionStatus.SUCCESS); trusted = true; break;
  }
  assert(trusted, "Trustline confirmation unavailable");
  await c.invoke(d.contracts.underlying, "transfer", [addr(admin), addr(me), nativeToScVal(deposit, { type: "i128" })], funder);
  const keys = deriveKeys(randomScalar(), addressToField(d.contracts.token));
  const engine = new StateEngine({ client: c, store: new MemoryStore(), keys, address: me, fromLedger });
  const register = new CircuitProver(loadCircuit("register"));
  const transfer = new CircuitProver(loadCircuit("transfer"));
  const withdraw = new CircuitProver(loadCircuit("withdraw"));
  const kAud = await c.auditorKey(d.auditor.id);
  const confirmed = (label: string, hash: string) => console.log(`PASS ${label}: ${hash}`);
  try {
    const rw = buildRegisterWitness(keys);
    confirmed("register", (await submitRegister(c, signer, me, d.auditor.id, rw, (await register.prove(rw.inputs)).proof)).hash);
    await submitDeposit(c, signer, me, me, deposit);
    await submitMerge(c, signer, me);
    await engine.sync(); assert((await engine.verifyAgainstChain()).ok);
    for (const branch of ["release", "refund"] as const) {
      const created = parseCreatedEscrow(await submitCreateEscrow(c, signer, me, me, null, branch === "refund" ? 1n : 3600n));
      console.log(`${branch} escrow = ${created.address}`);
      assert.equal(scValToNative(await c.simulate(created.address, "funding_protocol_version", [])), 2);
      const instanceKeys = deriveKeys(randomScalar(), keys.addrF);
      const registration = buildRegisterWitness(instanceKeys);
      const registerData = new Uint8Array(encodeRegisterData(registration, (await register.prove(registration.inputs)).proof).bytes());
      const current = await engine.sync();
      const incoming = buildTransferWitness({ keys, v: current.spendable.v, r: current.spendable.r, amount: 100_000n, pvkB: instanceKeys.PVK, kAudR: kAud, kAudS: kAud });
      const transferIn = new Uint8Array(encodeTransferData(incoming, (await transfer.prove(incoming.inputs)).proof).bytes());
      const release = buildTransferWitness({ keys: instanceKeys, v: 100_000n, r: incoming.recipientView.rTx, amount: 100_000n, pvkB: keys.PVK, kAudR: kAud, kAudS: kAud });
      const releaseData = new Uint8Array(encodeTransferData(release, (await transfer.prove(release.inputs)).proof).bytes());
      const refund = buildTransferWitness({ keys: instanceKeys, v: 100_000n, r: incoming.recipientView.rTx, amount: 100_000n, pvkB: keys.PVK, kAudR: kAud, kAudS: kAud });
      const refundData = new Uint8Array(encodeTransferData(refund, (await transfer.prove(refund.inputs)).proof).bytes());
      confirmed("prepare funding", (await submitPrepareFunding(c, signer, created.address, { registerData, auditorId: d.auditor.id, transferIn })).hash);
      confirmed("validate release", (await submitStorePayoutProof(c, signer, created.address, true, releaseData, release.next.r)).hash);
      confirmed("validate refund", (await submitStorePayoutProof(c, signer, created.address, false, refundData, refund.next.r)).hash);
      confirmed("fund", (await submitFund(c, signer, created.address)).hash);
      assert.equal((await readEscrow(c, created.address)).state, 1);
      await engine.sync(); assert((await engine.verifyAgainstChain()).ok);
      if (branch === "release") {
        await submitMarkCompleted(c, signer, created.address, "Testnet escrow regression");
        confirmed("release", (await submitRelease(c, signer, created.address)).hash);
        assert.equal((await readEscrow(c, created.address)).state, 3);
      } else {
        confirmed("timeout refund", (await submitTimeout(c, signer, created.address)).hash);
        assert.equal((await readEscrow(c, created.address)).state, 5);
      }
      await submitMerge(c, signer, me);
      const state = await engine.sync();
      assert.equal(state.spendable.v, deposit); assert((await engine.verifyAgainstChain()).ok);
      console.log(`PASS ${branch}: balances restored and both commitments match chain`);
    }
    const state = await engine.sync();
    const ww = buildWithdrawWitness({ keys, v: state.spendable.v, r: state.spendable.r, amount: deposit, kAudS: kAud });
    await submitWithdraw(c, signer, me, me, deposit, ww, (await withdraw.prove(ww.inputs)).proof);
    await c.invoke(d.contracts.underlying, "transfer", [addr(me), addr(admin), nativeToScVal(deposit, { type: "i128" })], signer);
    assert.equal(await balance(admin), initialPublic);
    console.log("PASS cleanup: funding identity test USDC restored; original payment deployment unchanged");
  } finally { await register.destroy(); await transfer.destroy(); await withdraw.destroy(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
