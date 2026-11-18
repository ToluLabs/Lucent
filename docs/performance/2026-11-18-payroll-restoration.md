# Payroll restoration follow-up — 18 November 2026

## Observed failures

The browser first displayed a Varial signing response with code -4. The user reported approving in the extension. That specific rejection has not been reproduced with a live signing trace; the error alone does not establish why the extension returned it.

A subsequent user-approved attempt reached submission and was rejected during `restore for execute_run`: declared write bytes 141,228 exceeded the network limit of 132,096. Payroll itself did not execute in that attempt. This is separate from the device-clock expiry issue.

## Corrections

- The installed `@stellar/freighter-api` 4.1.0 declares `address` for transaction signing but its packaged transport reads `accountToSign`. The adapter supplies both fields and rejects a returned signer address that differs from the connected account. A transport-level regression test reproduced the missing account before the fix and passes afterward. This mismatch is confirmed; causation of the original -4 is not.
- Restoration previously separated restoration from invocation, but still bundled every archived entry into one restoration transaction. The SDK now reads the network's `txMaxWriteBytes` configuration, simulates restoration, and recursively splits an oversized batch before requesting wallet approval. Every successful restoration is confirmed before the next; each uses a freshly fetched source sequence. Invocation is then rebuilt and simulated from scratch. Restoration batching does not split payroll execution or change its atomicity.
- A single oversized entry fails explicitly. Missing network configuration, unrelated simulation errors, wallet rejection and ambiguous submission outcomes stop the flow without an automatic retry of submitted transactions. Earlier confirmed restorations may remain useful even if a later step is cancelled; payroll has not yet executed.
- Resource-limit errors no longer suggest an insufficient balance as the explanation. Payroll approval progress and neutral signature-error wording were corrected in the preceding commit.

## Validation and limits

The configured Testnet RPC returned `txMaxWriteBytes = 132096` through a read-only configuration query. Regression tests reproduce a 141,228-byte aggregate and cover splitting, simulation-limit errors, per-batch sequences, cancellation, and an unsplittable entry. Wallet bridge tests exercise the actual installed API transport with simulated extension responses, including explicit account/network forwarding and no automatic retry after rejection.

SDK fast tests, app form tests and the production app build are the validation commands for this change. Optional live indexer parity requires a configured indexer. No wallet was signed and no financial transaction was submitted by the agent in this follow-up. Live wallet-approved restoration and payroll settlement still require user verification.

An archived deployment may now require several restoration approvals followed by payroll approval. This is recovery overhead, not a claim of single-approval payroll recovery. Keeping deployed contract entries alive through TTL maintenance is a separate operational improvement.
