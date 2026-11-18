import { recordPerformanceSample } from "@lucent/sdk/performance";
import type { ProofEngine, ProofResult } from "@lucent/sdk";
import type { NoirInputs } from "../../sdk/src/witness/common";
import manifest from "./proof-worker-manifest.json";

/** Dedicated, same-origin worker; witnesses never leave this browser process. */
export class WorkerProver implements ProofEngine {
  private next = 0;
  private closed = false;
  private pending = new Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  readonly ready: Promise<unknown>;
  private worker: Worker;
  constructor(
    artifact: unknown,
    createWorker: () => Worker = () =>
      new Worker(manifest.url, { type: "module" }),
    private onClosed?: () => void,
  ) {
    this.worker = createWorker();
    this.worker.onmessage = (event) => {
      const { id, ok, result, samples } = event.data;
      if (process.env.NODE_ENV === "development" && Array.isArray(samples)) {
        for (const sample of samples)
          recordPerformanceSample(sample.stage, sample.durationMs);
      }
      const request = this.pending.get(id);
      if (!request) return;
      clearTimeout(request.timer);
      this.pending.delete(id);
      if (ok) request.resolve(result);
      else
        request.reject(
          new Error(
            "Proof operation failed. Check the inputs and retry preparation.",
          ),
        );
    };
    this.worker.onerror = () =>
      this.close(
        "Proof worker failed. No transaction was submitted by this worker.",
      );
    this.worker.onmessageerror = () =>
      this.close("Proof worker response could not be read. Retry preparation.");
    this.ready = this.request("init", artifact);
  }
  private request(method: string, value?: unknown): Promise<any> {
    if (this.closed)
      return Promise.reject(new Error("Proof worker session ended"));
    const id = this.next++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          this.close(
            "Proof preparation stopped before completing. Retry preparation.",
          ),
        180_000,
      );
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.worker.postMessage(
          method === "init"
            ? {
                id,
                method,
                artifact: value,
                trace: process.env.NODE_ENV === "development",
              }
            : { id, method, value },
        );
      } catch {
        this.close("Proof request could not be prepared. Retry preparation.");
      }
    });
  }
  private close(message: string) {
    if (this.closed) return;
    this.closed = true;
    this.worker.terminate();
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error(message));
    }
    this.pending.clear();
    try {
      this.onClosed?.();
    } catch {
      /* Cleanup observers must not interrupt rejection. */
    }
  }
  async prove(inputs: NoirInputs): Promise<ProofResult> {
    await this.ready;
    return this.request("prove", inputs);
  }
  async verify(result: ProofResult): Promise<boolean> {
    await this.ready;
    return this.request("verify", result);
  }
  async verificationKey(): Promise<Uint8Array> {
    await this.ready;
    return this.request("verificationKey");
  }
  async destroy(): Promise<void> {
    this.close("Proof worker session ended");
  }
}
export async function workerProverFromArtifact(
  artifact: unknown,
  onCreated?: (prover: ProofEngine) => void,
  onClosed?: () => void,
): Promise<ProofEngine> {
  const prover = new WorkerProver(artifact, undefined, onClosed);
  onCreated?.(prover);
  try {
    await prover.ready;
    return prover;
  } catch (error) {
    await prover.destroy();
    throw error;
  }
}
