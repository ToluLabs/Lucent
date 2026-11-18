# Lucent performance implementation and browser acceptance

Date: 18 November 2026. Branch: `perf/query-cache-and-browser-acceptance`.
Baseline: `671229b`. Application implementation: `4ef7c41` (with SDK commits
`7a530e1` and `c6989c0`). No application or contract deployment was performed.

This follow-up completes the automated browser work left open in the
[initial audit](2026-11-17-audit.md). It also implements dedicated browser proving
workers after profiling confirmed a main-thread pause. Contract code, circuits,
verification keys, Keccak transcript, account storage and payroll atomicity remain
unchanged. This is performance and regression evidence, not a security audit.

## Results

Production browser measurements use identical Chrome, 1440×1000 viewport,
three cold/warm context pairs per route and the same benchmark script for an
isolated HEAD baseline and the final production build. Slow conditions emulate
150 ms latency, 1.6 Mbps download, 750 kbps upload and 4× CPU slowdown. Browser
contexts are isolated, analytics excluded and wallets deliberately disconnected.
The slow condition is **not a physical mobile-device test**.

| Measurement | Before | After | Scope |
| --- | --- | --- | --- |
| Cold overview JS transfer, fast network | 532,440 bytes | 238,546 bytes | Median; includes transfer overhead, about 55% less |
| Cold overview blocking, slow network/4× CPU | 602 ms | 89 ms | Median sum of long-task time above 50 ms |
| Warm overview LCP, slow network/4× CPU | 394 ms | 289 ms | Disconnected production screen, not a verified financial dashboard |
| Cold overview blocking, fast network | 83 ms | 0 ms | Median |
| Next.js home → docs navigation, fast | 43 ms | 42 ms | Median click-to-target-heading paint; already fast before |
| Same Next.js navigation, slow/4× CPU | 146 ms | 148 ms | Median; no improvement claimed |
| Proof run maximum main-thread long task | 150 ms | 0 ms | One matched real-browser registration cold/warm pair |
| Identical simultaneous read simulations | 40 requests | 1 request | Controlled 20-caller RPC fixture, not live load traffic |
| 24 independent metadata reads, 50 ms latency | 1,224 ms | 306 ms | Controlled sequential versus four-worker read fixture |

The query provider costs about **10.7 KB additional cold JS transfer on public
landing/docs pages**. This tradeoff is recorded rather than presenting every
metric as an improvement. Connected data caching and removing a heavy SDK import
produce the much larger overview saving. The test does not establish field-user
percentiles or cold wallet-connect duration.

Raw evidence: [baseline](browser-before.json), [final](browser-after.json),
[computed medians](browser-summary.json), [coverage](browser-acceptance-summary.json),
[fixture navigation](connected-navigation.json), [RPC baseline](read-before.json),
[RPC after](read-after.json), [list comparison](list-before-after.json).

The connected-page fixture measured roughly 11 ms to Payments and 7 ms returning
to Overview, with zero extra activity requests on the warm return. Those figures
measure real React page components and QueryClient with a mocked wallet and fixture
SPA router. They do **not** establish actual Next.js connected-wallet latency.
The separate production navigation numbers above use the real Next.js router.

## Confirmed bottlenecks and fixes

1. **Heavy SDK initialization from a display-only enum.** Overview's escrow-label
   helper imported `EscrowState` through the SDK root. That included unrelated
   crypto/proving initialization. Lifecycle enums now have the lightweight
   `@lucent/sdk/chain/status` entry point; original SDK exports stay compatible.
2. **Repeated and serial RPC work.** Read simulations no longer fetch a source
   account first. Concurrent identical reads share one simulation; the slot clears
   after completion or failure, so authoritative reads receive no TTL cache.
   The optimized synthetic-source read was checked against public Testnet.
   Payroll/escrow metadata and recipient reads use bounded parallelism and preserve
   input ordering. Spending-dependent payroll proofs remain sequential.
3. **Route-local fetching and activity rescans.** One scoped TanStack Query v5
   client owns public metadata reads. Activity fetches keep a successful cursor and
   request only the tail. Duplicate events are deduplicated; a failed/missing tail
   never advances the cursor or replaces prior history. Visible activity pages fetch
   only their own escrow counterparties. Search is memoized and deferred.
4. **Cold proof setup on the UI thread.** Noir witness solving and the exact pinned
   bb.js proving/verification run in a dedicated same-origin worker. Native bb.js
   workers remain intact. The worker uses the unchanged SDK Keccak prover, not a
   replacement proof system. Proof results and public verification keys cross back
   to the UI; witnesses never go to a server. Worker exceptions are sanitized.
5. **Prover startup, memory and cancellation.** Circuits are imported lazily and
   worker-backed provers are reused per circuit. Idle prewarming is not enabled.
   A closed wallet cancels live workers, including initialization, and a late
   wallet signature cannot be submitted after disconnect. Failed workers are
   evicted from the wallet's prover cache. Browser tests finish with zero remaining
   workers. Peak physical-device RAM/battery use is not quantified.
6. **Unnecessary global updates.** Bounded diagnostic logs no longer update global
   React state per line. Confidential amounts and available-balance values were
   removed from wallet diagnostics. Financial view updates still publish normally.
7. **Stale/manual refresh and lifecycle races.** Refresh account explicitly refreshes
   public balance/activity; auditor Refresh bypasses the display cache. A new browser
   regression reproduced a delayed permission check reconnecting after Disconnect.
   Generation/manual-disconnect checks now prevent it, as well as late connect and
   old-wallet refresh results overwriting another session.
8. **Ambiguous transaction outcomes.** Submitted hashes appear before confirmation;
   the first confirmation read is immediate and later polling remains bounded.
   Network errors retain the hash and uncertainty guard. An accepted submission or
   successful preparatory transaction is never treated as whole-action success.

## Real browser proof validation

[Main-thread reference](browser-proving-main.json),
[worker comparison](browser-proving-worker.json),
[all worker circuits](browser-proving-all-worker.json).

The final worker run generated and verified seven real proofs across five circuits,
including warm reuse for registration and transfer. Every derived verification key
matched its pinned core/disclosure artifact. All proof payloads remained 14,592 bytes.
The all-circuit run recorded zero main-thread long tasks and zero workers remaining
after destruction. Tests use synthetic keys and inputs and submit no transactions.

Representative all-circuit timings:

| Circuit | Cold prove | Warm prove | Verification |
| --- | --- | --- | --- |
| Register | 3.33 s | 2.22 s | ~0.93 s |
| Withdraw | 4.91 s | Not sampled | ~1.68 s |
| Transfer | 4.70 s | 4.23 s | ~1.73 s |
| Recipient disclosure | 2.86 s | Not sampled | ~0.99 s |
| Sender disclosure | 2.86 s | Not sampled | ~0.99 s |

One pair is diagnostic, not a statistical speed claim. The worker's benefit is
responsiveness; it does not eliminate cryptographic work. The first call includes
worker/WASM/backend startup. A cold development-server compilation can also take
seconds and is not comparable with these production-build measurements. Browser/native download caches can already be warm;
these are not first-ever-on-device CRS download timings. No thread-count change
or concurrent state-dependent payroll proving was introduced.

`ProofEngine` abstracts the existing prove/verify/key/destroy API. The default Node
`CircuitProver` remains available. The browser adapter is used for wallet proofs
and disclosure verification. Worker code and both pinned Noir WASM companions are
built under a content-derived directory; the URL manifest is generated before
Next.js builds. Production checks verified the worker/WASM responses, cross-origin
isolation and immutable cache headers. `pnpm vendor:bb` builds both asset groups.

### Live Testnet verifier simulation

A separate [read-only Testnet run](testnet-proof-simulation.json) generated the
proofs in Chrome workers and passed registration, withdrawal and transfer proofs
to the deployed `verify_proof` contract method using RPC simulation. All three
returned `true`; the simulations took approximately 1,498 ms, 392 ms and 485 ms.
This is actual deployed-verifier compatibility evidence, **not a submitted token
transaction**. It does not establish account authorization, token balances or
settlement. No signer was supplied, no funds moved and no ledger success hash is
claimed. The test used synthetic inputs, not the user's private wallet state.

## Caching, integrity and trace boundaries

See the initial audit for query keys and policies. The important invariants remain:

- Query keys include network/RPC, configured contract/event-source IDs, wallet and
  resource identifiers. Default display freshness is 30 seconds, 10 seconds for
  registration display; one read retry, five-minute collection, no focus refetch.
- QueryClient is memory-only. It stores public metadata/ciphertext, never private
  keys, decrypted amounts, openings, unrestricted wallet state or auditor replay.
- Connection/disconnection clears query state. Confirmed actions invalidate their
  account/resource scope. Pending/failed actions are not treated as settled.
- Confidential state stays in the existing state engine. Mutations are serialized;
  spending syncs and verifies both commitments freshly before preparing a proof.
- A public-balance outage is shown as Unavailable; it does not invent zero or block
  otherwise verified confidential balances. A confidential mismatch still blocks spending.
- Missing/incomplete history is not silently accepted as full history. Escrow read
  failures are propagated rather than presenting a partial list as complete.
- Proving workers execute local code and never sign or submit transactions. Disconnect
  stops the worker and guards wallet signing; ambiguous network submissions still
  require checking the chain before retrying.
- Development timing records allowlisted stage names and finite durations only.
  Worker timing samples join the local trace; errors/witnesses/amounts are excluded.
  Inspect `window.__lucentPerformance()` and DevTools User Timing in development.
  Production timing remains disabled by default. No new telemetry is sent.

## Validation and coverage

Passed on the final implementation:

- Production build and TypeScript.
- Complete SDK suite, including real register/transfer/withdraw proofs and 19
  disclosure checks; stale commitments, missing/duplicate events, rebuild and
  cross-network/token namespaces retain their existing regressions.
- 51 native Soroban contract tests, including payroll/escrow lifecycle and
  authorization/replay guards. These suites use mocks and are not live execution.
- Wallet/forms/actions, query cache isolation/invalidation, cancellation, incremental
  history, failed confirmation, hash preservation and repeated-action tests.
- Worker crash, sanitized failure, disconnect during initialization/proving and
  worker cleanup checks. Real-browser proof/key compatibility as described above.
- Real provider reconnection/disconnect/race tests, plus connected mocked UI tests:
  setup, recipient errors, payment review, confirmed/declined/uncertain/reloaded
  actions, pending hash links, duplicate clicks, payroll, escrow review and dialogs.
- 60 production page/viewport checks: 12 routes across 320, 390, 768, 1440 and 1920
  pixels, with no reported accessibility, overflow or runtime errors. Connected
  fixture accessibility/responsive checks also passed.
- Existing analytics privacy/host/opt-out/DNT/GPC/deduplication tests.

The browser summary previously hard-coded 13 routes; it now derives actual route
and viewport counts from measured rows. The fixture backend was corrected to expose
its confirmed mock state synchronously, matching a confirmed chain read rather
than waiting for a React render to update its ref.

## Remaining acceptance boundaries

Automated coverage is complete for this change, but the following were **not**
performed and must not be inferred from mocks or proof validation:

- A new live Varial signing/deposit/payment/withdraw/payroll/escrow smoke test using
  this build. Browser harnesses use isolated profiles without the user's extension;
  earlier successful Testnet transactions preceded this performance patch. No new
  financial Testnet transaction was submitted by this audit.
- Live timeout-refund/arbiter settlement, production indexer parity and recovery from
  history beyond RPC retention. No live indexer is configured; that test is skipped.
- A physical low-powered device, Safari/iOS wallet integration, field-user percentiles,
  peak proof RAM or long-lived multi-circuit battery behavior.

Per-workflow coverage: initial load/navigation use real production browser metrics;
connect/reconnect use the real provider with a mocked extension; registration,
transfer, withdrawal and both disclosure circuits use real browser cryptography;
deposit/merge/payroll/escrow UI flows use mocked wallet operations plus existing
SDK/native contract safety tests; auditor replay remains local and is covered by
SDK/decryption tests and UI rendering. Recovery uses engine regression tests, not
a fresh live full-history indexer. Actual chain confirmation/wallet approval waits
cannot be derived from these component measurements.

The <200 ms navigation target held for the sampled disconnected route transition.
The warm disconnected overview painted under 500 ms in the emulated slow condition.
The connected fixture cache returned without another activity fetch. These results
are narrower than certifying every connected dashboard/device against every target.

## Reproduction

```sh
pnpm --filter @lucent/sdk test
pnpm --filter @lucent/app test:forms
pnpm --filter @lucent/app test:performance
pnpm test:analytics
pnpm --filter @lucent/app build
(cd contracts && cargo test --workspace)

# Supply a local Chrome/Chromium executable if not installed through Playwright.
export CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
UI_SCREENSHOTS=/tmp/lucent-ui pnpm --filter @lucent/app test:ui
UI_SCREENSHOTS=/tmp/lucent-browser pnpm --filter @lucent/app test:browser
PERF_REPORT=/tmp/lucent-browser-after.json pnpm --filter @lucent/app profile:acceptance
PROOF_MODE=worker PROOF_ALL=1 PERF_REPORT=/tmp/lucent-proofs.json pnpm --filter @lucent/app profile:proof
# Optional: public Testnet verifier simulation only; no signing or submission.
PROOF_MODE=worker PROOF_ALL=1 PERF_VERIFY_TESTNET=1 PERF_REPORT=/tmp/lucent-testnet-proofs.json pnpm --filter @lucent/app profile:proof
```

For baseline comparison, build `671229b` in an isolated checkout with the same
locked dependency versions and run the current benchmark script with
`PERF_APP_ROOT=/path/to/baseline/packages/app`. Do not compare a development server
against a production build. Do not use real wallet keys in these fixtures.

## Further architecture work

The next changes require separate benchmarks/security review: owner-scoped indexed
pagination (bounded reads remain O(global registry size)); durable historical
indexing; fewer escrow funding approvals; physical-device memory/thread profiling;
and any capped prover pool or idle prewarming policy. This patch does not replace
current escrow authorization or claim that four funding approvals are unavoidable.
