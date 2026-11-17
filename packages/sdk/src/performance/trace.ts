/** Opt-in local timings only. Never accepts payloads, addresses, errors or witness data. */
export type PerfStage =
  | "rpc.read"
  | "tx.simulate"
  | "tx.wallet_wait"
  | "tx.submit"
  | "tx.confirm"
  | "prover.init"
  | "prover.witness"
  | "prover.prove"
  | "prover.verify"
  | "state.sync"
  | "wallet.refresh";
let enabled = false;
let sequence = 0;
const samples: { stage: PerfStage; durationMs: number }[] = [];
export function setPerformanceTracing(value: boolean): void {
  enabled = value;
}
export function performanceSamples() {
  return samples.map((s) => ({ ...s }));
}
export async function timed<T>(
  stage: PerfStage,
  fn: () => Promise<T>,
): Promise<T> {
  if (!enabled || typeof performance === "undefined") return fn();
  const id = `lucent:${stage}:${sequence++}`;
  const start = performance.now();
  performance.mark(id);
  try {
    return await fn();
  } finally {
    const end = `${id}:end`;
    performance.mark(end);
    performance.measure(stage, id, end);
    performance.clearMarks(id);
    performance.clearMarks(end);
    performance.clearMeasures(stage);
    samples.push({ stage, durationMs: performance.now() - start });
    if (samples.length > 200) samples.shift();
  }
}
