import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { CircuitProver } from '../src/proving/prover.ts';
import { loadCircuit } from '../src/proving/artifacts.ts';
import { deriveKeys } from '../src/crypto/keys.ts';
import { buildRegisterWitness } from '../src/witness/register.ts';
import { setPerformanceTracing, performanceSamples } from '../src/performance/trace.ts';
setPerformanceTracing(true);
const prover=new CircuitProver(loadCircuit('register'));
const samples=[];
try {
 for(const mode of ['cold-backend','warm-backend']) {
  const start=performance.now();
  const result=await prover.prove(buildRegisterWitness(deriveKeys(1n,2n)).inputs);
  const provingMs=performance.now()-start;
  const verifyStart=performance.now();assert(await prover.verify(result));
  samples.push({mode,provingMs,verifyMs:performance.now()-verifyStart,proofBytes:result.proof.length});
 }
 console.log(JSON.stringify({conditions:'Node, real registration UltraHonk+Keccak proofs; same circuit and inputs, backend reused; CRS may already be cached. Not a cold browser download measurement.',samples,stages:performanceSamples()},null,2));
} finally {await prover.destroy();}
