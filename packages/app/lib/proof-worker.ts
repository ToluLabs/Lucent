/// <reference lib="webworker" />
import {
  CircuitProver,
  setUltraHonkBackendLoader,
} from "../../sdk/src/proving/prover";
import {
  setPerformanceTracing,
  takePerformanceSamples,
} from "../../sdk/src/performance/trace";
let prover: CircuitProver | undefined;
const nativeImport = new Function("url", "return import(url)") as (
  url: string,
) => Promise<any>;
setUltraHonkBackendLoader(
  async () => (await nativeImport("/vendor/bb/index.js")).UltraHonkBackend,
);
self.onmessage = async (event: MessageEvent) => {
  const { id, method, artifact, value } = event.data;
  try {
    let result: unknown;
    if (method === "init") {
      if (prover) throw new Error("Already initialized");
      setPerformanceTracing(event.data.trace === true);
      prover = new CircuitProver(artifact);
      result = true;
    } else {
      if (!prover) throw new Error("Not initialized");
      if (method === "prove") result = await prover.prove(value);
      else if (method === "verify") result = await prover.verify(value);
      else if (method === "verificationKey")
        result = await prover.verificationKey();
      else throw new Error("Unknown operation");
    }
    self.postMessage({
      id,
      ok: true,
      result,
      samples: takePerformanceSamples(),
    });
  } catch {
    // Witness solver errors can contain input data. Never post error objects or input values.
    self.postMessage({ id, ok: false });
    takePerformanceSamples();
  }
};
