import assert from 'node:assert/strict';
import { CircuitProver, setUltraHonkBackendLoader } from '../src/proving/prover.ts';
import { loadCircuit } from '../src/proving/artifacts.ts';
import { deriveKeys } from '../src/crypto/keys.ts';
import { buildRegisterWitness } from '../src/witness/register.ts';
import { setPerformanceTracing, performanceSamples } from '../src/performance/trace.ts';
let created=0,active=0,peak=0,destroyed=0;
class FakeBackend {
 constructor(){created++;}
 async generateProof(witness,options){assert.equal(options.keccak,true);active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,5));active--;return {proof:new Uint8Array(1),publicInputs:[]};}
 async verifyProof(result,options){assert.equal(options.keccak,true);return true;}
 async getVerificationKey(options){assert.equal(options.keccak,true);return new Uint8Array(1);}
 async destroy(){destroyed++;assert.equal(active,0);}
}
setPerformanceTracing(true);
setUltraHonkBackendLoader(async()=>{await new Promise(r=>setTimeout(r,5));return FakeBackend;});
const prover=new CircuitProver(loadCircuit('register'));
const inputs=buildRegisterWitness(deriveKeys(1n,2n)).inputs;
await Promise.all([prover.prove(inputs),prover.prove(inputs),prover.verificationKey()]);
assert.equal(created,1);assert.equal(peak,1);
assert.equal(await prover.verify({proof:new Uint8Array(1),publicInputs:[]}),true);
const pending=prover.prove(inputs);const cleanup=prover.destroy();await pending;await cleanup;assert.equal(destroyed,1);
await assert.rejects(prover.prove(inputs),/destroyed/);
const samples=performanceSamples();assert(samples.every(s=>Object.keys(s).sort().join(',')==='durationMs,stage'));
assert(samples.some(s=>s.stage==='prover.witness'));
console.log('Prover lifecycle: one backend, sequential execution, mandatory Keccak, drain before destruction, closed rejection, timing payload allowlist passed (mock backend, real Noir witness).');
