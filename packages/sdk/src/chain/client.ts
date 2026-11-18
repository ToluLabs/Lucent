/**
 * Soroban RPC client: read-only simulation, full invoke (build → simulate →
 * assemble → sign → send → poll), and typed reads of confidential state.
 *
 * No indexer. State that the protocol exposes only through events is read with
 * the RPC `getEvents` API (see `events.ts`), accepting its ~7-day retention
 * window — the central trade-off of this demo.
 */

import {
  xdr,
  Address,
  Account,
  Contract,
  Keypair,
  TransactionBuilder,
  BASE_FEE,
  rpc,
  scValToNative,
  Operation,
  SorobanDataBuilder,
  FeeBumpTransaction,
  Transaction,
} from "@stellar/stellar-sdk";

import { pointFromBytes, type Point } from "../crypto/grumpkin.js";

/** Source used for read-only simulation; never signs, never pays. */
const NULL_ACCOUNT = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60;

/**
 * Minimal transaction signer. A Node script wraps a {@link Keypair} via
 * {@link keypairSigner}; the web app wraps Varial's `signTransaction`.
 */
export interface Signer {
  /** G-address of the signer (transaction source / auth principal). */
  publicKey: string;
  /** Sign an assembled transaction (base64 XDR) and return signed base64 XDR. */
  sign(txXdrBase64: string): Promise<string>;
}

export interface ContractIds {
  token: string;
  verifier: string;
  auditor: string;
  /** PayrollVault (orchestrator) — optional; only the payroll flows need it. */
  payroll?: string;
  /** PrivateEscrow factory — optional; only the escrow flows need it. */
  escrowFactory?: string;
  /** Compliance allowlist policy — optional; only the compliance UI needs it. */
  policy?: string;
}

export interface ChainConfig {
  rpcUrl: string;
  /** Per HTTP request; transaction confirmation has its own bounded poll loop. */
  rpcTimeoutMs?: number;
  /** Public hash notification after submission; never a success signal. */
  onSubmitted?: (hash: string) => void;
  networkPassphrase: string;
  contracts: ContractIds;
}

export interface InvokeResult {
  hash: string;
  status: string;
  /** Return value of the invoked function (if any). */
  returnValue?: xdr.ScVal;
}

/** On-chain confidential account (`confidential_balance` return value). */
export interface OnChainAccount {
  spendingKey: Point;
  viewingPublicKey: Point;
  spendableBalance: Point;
  receivingBalance: Point;
  auditorId: number;
}

export function keypairSigner(
  secret: string,
  networkPassphrase: string,
): Signer {
  const kp = Keypair.fromSecret(secret);
  return {
    publicKey: kp.publicKey(),
    async sign(txXdrBase64: string): Promise<string> {
      const tx = TransactionBuilder.fromXDR(txXdrBase64, networkPassphrase);
      tx.sign(kp);
      return tx.toXDR();
    },
  };
}

import { timed } from "../performance/trace.js";

export class ChainClient {
  private readonly reads = new Map<string, Promise<xdr.ScVal>>();
  readonly server: rpc.Server;

  constructor(readonly cfg: ChainConfig) {
    this.server = new rpc.Server(cfg.rpcUrl, {
      allowHttp: cfg.rpcUrl.startsWith("http://"),
    });
    const timeout = cfg.rpcTimeoutMs ?? 30_000;
    if (!Number.isFinite(timeout) || timeout <= 0)
      throw new Error("rpcTimeoutMs must be positive");
    // SDK 14.6.1 declares Server.Options.timeout but does not forward it.
    // Configure the actual HTTP client so stalled RPC calls still terminate.
    this.server.httpClient.defaults.timeout = timeout;
  }

  // ----- reads -------------------------------------------------------------

  /** Simulate a read-only call and return its raw `ScVal` result. */
  async simulate(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<xdr.ScVal> {
    // Read simulation does not require a funded transaction source or a signature.
    const key = JSON.stringify([
      contractId,
      method,
      args.map((arg) => arg.toXDR("base64")),
    ]);
    const pending = this.reads.get(key);
    if (pending) return pending;
    const request = timed("rpc.read", () =>
      this.simulateRead(contractId, method, args),
    );
    this.reads.set(key, request);
    try {
      return await request;
    } finally {
      if (this.reads.get(key) === request) this.reads.delete(key);
    }
  }

  private async simulateRead(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<xdr.ScVal> {
    const account = new Account(NULL_ACCOUNT, "0");
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.cfg.networkPassphrase,
    })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(30)
      .build();

    const sim = await timed("tx.simulate", () =>
      this.server.simulateTransaction(tx),
    );
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`simulate ${method} failed: ${sim.error}`);
    }
    const ok = sim as rpc.Api.SimulateTransactionSuccessResponse;
    if (!ok.result) throw new Error(`simulate ${method}: no result`);
    return ok.result.retval;
  }

  /** Read a confidential account, or `null` if `address` is not registered. */
  async confidentialBalance(address: string): Promise<OnChainAccount | null> {
    try {
      const retval = await this.simulate(
        this.cfg.contracts.token,
        "confidential_balance",
        [new Address(address).toScVal()],
      );
      return parseAccount(retval);
    } catch (error) {
      // Only the token's explicit AccountNotRegistered error means absence.
      // RPC outages, archived entries and malformed responses must stay errors.
      if (
        error instanceof Error &&
        /^simulate confidential_balance failed: HostError: Error\(Contract, #3501\)/.test(
          error.message,
        )
      ) {
        return null;
      }
      throw error;
    }
  }

  async isRegistered(address: string): Promise<boolean> {
    return (await this.confidentialBalance(address)) !== null;
  }

  /** Fetch auditor key `K_aud` (BytesN<64>) for an `auditor_id`. */
  async auditorKey(auditorId: number): Promise<Point> {
    const retval = await this.simulate(this.cfg.contracts.auditor, "get_key", [
      xdr.ScVal.scvU32(auditorId),
    ]);
    return pointFromBytes(new Uint8Array(retval.bytes()));
  }

  async latestLedger(): Promise<number> {
    return (await this.server.getHealth()).latestLedger;
  }

  private clock?: { seconds: number; monotonicMs: number };
  private clockFlight?: Promise<number>;

  /** NOT_FOUND responses include ledger time without decoding ledger XDR. */
  private async networkTime(): Promise<number> {
    const now = performance.now();
    if (this.clock && now - this.clock.monotonicMs < 20_000)
      return this.clock.seconds + Math.floor((now - this.clock.monotonicMs) / 1000);
    if (this.clockFlight) return this.clockFlight;
    this.clockFlight = (async () => {
      const response = await this.server.getTransaction("0".repeat(64));
      const seconds = Number(response.latestLedgerCloseTime);
      if (!Number.isSafeInteger(seconds) || seconds <= 0)
        throw new Error("Invalid ledger time");
      this.clock = { seconds, monotonicMs: performance.now() };
      return seconds;
    })().catch(() => {
      throw new Error("Stellar ledger time unavailable; transaction preparation stopped. Nothing was submitted.");
    }).finally(() => { this.clockFlight = undefined; });
    return this.clockFlight;
  }

  // ----- writes ------------------------------------------------------------

  /**
   * Build, simulate, assemble, sign, submit, and poll a contract invocation.
   * Auth is taken from simulation; for these demo ops the source account is the
   * sole auth principal, so a single signature suffices.
   */
  async invoke(
    contractId: string,
    method: string,
    args: xdr.ScVal[],
    signer: Signer,
    restored = false,
  ): Promise<InvokeResult> {
    const source = await this.server.getAccount(signer.publicKey);
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.cfg.networkPassphrase,
    })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimebounds(0, (await this.networkTime()) + 300)
      .build();

    const sim = await timed("tx.simulate", () =>
      this.server.simulateTransaction(tx),
    );
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`simulate ${method} failed: ${sim.error}`);
    }
    const data = sim.transactionData.build();
    const archived =
      data.ext().switch() === 1
        ? data.ext().resourceExt().archivedSorobanEntries()
        : [];
    if (archived.length) {
      if (restored)
        throw new Error(
          `${method}: ledger entries are still archived after restoration; retry the account operation`,
        );
      const footprint = data.resources().footprint().readWrite();
      const keys = archived.map((index) => {
        const key = footprint[index];
        if (!key) throw new Error("Simulation returned an invalid archived entry index");
        return key;
      });
      const configKey = xdr.LedgerKey.configSetting(new xdr.LedgerKeyConfigSetting({
        configSettingId: xdr.ConfigSettingId.configSettingContractLedgerCostV0(),
      }));
      const config = await this.server.getLedgerEntries(configKey);
      const writeLimit = config.entries[0]?.val.configSetting().contractLedgerCost().txMaxWriteBytes();
      if (!writeLimit || !Number.isSafeInteger(writeLimit) || writeLimit <= 0)
        throw new Error("Cannot read Stellar restoration resource limit; nothing was restored.");
      await this.restoreArchived(keys, signer, method, writeLimit);
      return this.invoke(contractId, method, args, signer, true);
    }
    const assembled = rpc.assembleTransaction(tx, sim).build();
    return this.submit(assembled, signer, method);
  }

  /** Split oversized restorations BEFORE approval, never retry submitted writes. */
  private async restoreArchived(
    keys: xdr.LedgerKey[], signer: Signer, method: string, writeLimit: number,
  ): Promise<void> {
    const tx = new TransactionBuilder(await this.server.getAccount(signer.publicKey), {
      fee: BASE_FEE, networkPassphrase: this.cfg.networkPassphrase,
    })
      .setSorobanData(new SorobanDataBuilder().setReadWrite(keys).build())
      .addOperation(Operation.restoreFootprint({}))
      .setTimebounds(0, (await this.networkTime()) + 300)
      .build();
    const sim = await this.server.simulateTransaction(tx);
    const error = rpc.Api.isSimulationError(sim) ? sim.error : undefined;
    const oversized = error
      ? /exceed.*limit|limit.*exceed/i.test(error)
      : !rpc.Api.isSimulationError(sim) && sim.transactionData.build().resources().writeBytes() > writeLimit;
    if (oversized) {
      if (keys.length <= 1)
        throw new Error(`A single archived entry exceeds Stellar's restoration limit; ${method} was not executed.`);
      const midpoint = Math.ceil(keys.length / 2);
      await this.restoreArchived(keys.slice(0, midpoint), signer, method, writeLimit);
      await this.restoreArchived(keys.slice(midpoint), signer, method, writeLimit);
      return;
    }
    if (rpc.Api.isSimulationError(sim))
      throw new Error(`simulate restore for ${method} failed: ${sim.error}`);
    await this.submit(rpc.assembleTransaction(tx, sim).build(), signer, `restore for ${method}`);
  }

  private async submit(
    assembled: Transaction,
    signer: Signer,
    method: string,
  ): Promise<InvokeResult> {
    // Change only unsigned time bounds after simulation. Rebuilding through a
    // TransactionBuilder can add the Soroban resource fee a second time.
    const envelope = assembled.toEnvelope();
    envelope.v1().tx().cond().timeBounds().maxTime(
      xdr.Uint64.fromString(String((await this.networkTime()) + 300)),
    );
    const fresh = new Transaction(envelope, this.cfg.networkPassphrase);
    let signedXdr: string;
    try {
      signedXdr = await timed("tx.wallet_wait", () => signer.sign(fresh.toXDR()));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Wallet did not return a signature";
      // Size and method identify wallet compatibility failures without exposing
      // transaction contents, witnesses or decrypted account state.
      throw new Error(`Wallet signing for ${method} failed before submission (${fresh.toEnvelope().toXDR().byteLength} XDR bytes): ${message}`);
    }
    const signedTx = TransactionBuilder.fromXDR(
      signedXdr,
      this.cfg.networkPassphrase,
    );

    const bounds = signedTx instanceof FeeBumpTransaction
      ? signedTx.innerTransaction.timeBounds : signedTx.timeBounds;
    const maxTime = Number(bounds?.maxTime ?? 0);
    if (maxTime === 0 || maxTime <= (await this.networkTime()) + 10)
      throw new Error('Transaction expired before submission. Nothing was submitted; prepare it again and approve the new wallet request.');
    let send;
    try {
      send = await timed("tx.submit", () =>
        this.server.sendTransaction(signedTx),
      );
    } catch {
      throw new Error(
        `${method} submission confirmation unknown after network error (tx ${signedTx.hash().toString("hex")}); check before retrying`,
      );
    }
    if (send.status === "ERROR") {
      const diagnostics = (send.diagnosticEvents ?? []).map((diagnostic) => {
        const event = diagnostic.event().body().v0();
        return JSON.stringify(
          {
            topics: event.topics().map((topic) => scValToNative(topic)),
            data: scValToNative(event.data()),
          },
          (_, value) => (typeof value === "bigint" ? value.toString() : value),
        );
      });
      throw new Error(
        `send ${method} rejected (${send.errorResult?.result().switch().name ?? "unknown"}, tx ${send.hash})` +
          (diagnostics.length
            ? `: ${diagnostics.join("; ")}`
            : `: ${JSON.stringify(send.errorResult)}`),
      );
    }

    try {
      this.cfg.onSubmitted?.(send.hash);
    } catch {
      /* Observers cannot interrupt confirmation. */
    }
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      if (i > 0) await sleep(POLL_INTERVAL_MS);
      let res;
      try {
        res = await timed("tx.confirm", () =>
          this.server.getTransaction(send.hash),
        );
      } catch {
        throw new Error(
          `${method} confirmation unknown after network error (tx ${send.hash}); check before retrying`,
        );
      }
      if (res.status === rpc.Api.GetTransactionStatus.NOT_FOUND) continue;
      if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`${method} failed on-chain (tx ${send.hash})`);
      }
      if (res.status !== rpc.Api.GetTransactionStatus.SUCCESS) continue;
      return {
        hash: send.hash,
        status: res.status,
        returnValue: res.returnValue,
      };
    }
    throw new Error(`${method} confirmation timed out (tx ${send.hash})`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseAccount(val: xdr.ScVal): OnChainAccount {
  const entries = val.map();
  if (!entries) throw new Error("expected ScMap for ConfidentialAccount");
  const out: Partial<OnChainAccount> = {};
  for (const e of entries) {
    const key = e.key().sym().toString();
    switch (key) {
      case "spending_key":
        out.spendingKey = pointFromBytes(new Uint8Array(e.val().bytes()));
        break;
      case "viewing_public_key":
        out.viewingPublicKey = pointFromBytes(new Uint8Array(e.val().bytes()));
        break;
      case "spendable_balance":
        out.spendableBalance = pointFromBytes(new Uint8Array(e.val().bytes()));
        break;
      case "receiving_balance":
        out.receivingBalance = pointFromBytes(new Uint8Array(e.val().bytes()));
        break;
      case "auditor_id":
        out.auditorId = e.val().u32();
        break;
    }
  }
  return out as OnChainAccount;
}
