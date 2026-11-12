/** Replace only the Testnet escrow stack; preserve the token and its accounts. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { Address, scValToNative, xdr } from "@stellar/stellar-sdk";
import { ChainClient } from "../packages/sdk/src/chain/client.js";
import { APP_DEPLOYMENT, DEPLOYMENTS, WASM, deploy, uploadWasm, publicKey } from "./_shared.js";

async function main() {
  const dep = JSON.parse(readFileSync(APP_DEPLOYMENT, "utf8"));
  if (dep.network !== "testnet" || dep.passphrase !== "Test SDF Network ; September 2015" || dep.rpcUrl !== "https://soroban-testnet.stellar.org")
    throw new Error("Escrow-only deployment is restricted to the public Stellar Testnet.");
  const client = new ChainClient({ rpcUrl: dep.rpcUrl, networkPassphrase: dep.passphrase, contracts: dep.contracts });
  // Read immutable token configuration directly, rather than trusting a stale
  // manifest to choose the registries used to preflight future payouts.
  const key = xdr.LedgerKey.contractData(new xdr.LedgerKeyContractData({
    contract: new Address(dep.contracts.token).toScAddress(),
    key: xdr.ScVal.scvLedgerKeyContractInstance(), durability: xdr.ContractDataDurability.persistent(),
  }));
  const result = await client.server.getLedgerEntries(key);
  const storage = result.entries[0]?.val.contractData().val().instance().storage() ?? [];
  const binding = (name: string) => storage.find(entry => String(scValToNative(entry.key())) === name);
  for (const [name, expected] of [["Verifier", dep.contracts.verifier], ["Auditor", dep.contracts.auditor]]) {
    const entry = binding(name);
    if (!entry || scValToNative(entry.val()) !== expected)
      throw new Error(`Token ${name} does not match the public deployment. No contracts deployed.`);
  }
  const source = process.env.STELLAR_ESCROW_SOURCE ?? "admin";
  await client.server.getAccount(publicKey(source));
  // Never print or replace private operator records with the redacted mirror.
  const privateDep = existsSync(DEPLOYMENTS) ? JSON.parse(readFileSync(DEPLOYMENTS, "utf8")) : null;
  if (privateDep && privateDep.contracts.token !== dep.contracts.token)
    throw new Error("Private and public deployment records disagree; no contracts deployed.");
  const escrowValidator = deploy(WASM.escrowValidator, source, [
    "--token", dep.contracts.token, "--verifier", dep.contracts.verifier, "--auditor", dep.contracts.auditor,
  ]);
  console.log(`escrow validator = ${escrowValidator}`);
  const escrowInstanceWasm = uploadWasm(WASM.escrowInstance, source);
  console.log(`escrow instance WASM = ${escrowInstanceWasm}`);
  const escrowFactory = deploy(WASM.escrowFactory, source, [
    "--token", dep.contracts.token, "--instance_wasm", escrowInstanceWasm, "--payout_validator", escrowValidator,
  ]);
  console.log(`escrow factory = ${escrowFactory}`);
  const actual = scValToNative(await client.simulate(escrowValidator, "token", []));
  if (actual !== dep.contracts.token) throw new Error("Validator token binding mismatch; deployment records unchanged.");
  const legacyEscrowFactories = [...new Set([...(dep.contracts.legacyEscrowFactories ?? []), dep.contracts.escrowFactory])].filter(Boolean);
  const update = { escrowFactory, escrowValidator, escrowInstanceWasm, legacyEscrowFactories };
  if (privateDep) {
    privateDep.contracts = { ...privateDep.contracts, ...update };
    writeFileSync(DEPLOYMENTS, JSON.stringify(privateDep, null, 2) + "\n");
  }
  dep.contracts = { ...dep.contracts, ...update };
  writeFileSync(APP_DEPLOYMENT, JSON.stringify(dep, null, 2) + "\n");
  console.log("Updated escrow references only; existing token, accounts, balances and old escrow references preserved.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
