# Transaction expiry follow-up — 18 November 2026

## Diagnosis

All SDK writes used `setTimeout(180)`, which derives transaction expiry from the device wall clock. The configured Testnet RPC reported ledger time 2026-11-18T07:50:11Z while the local runtime reported 2026-11-18T00:37:06Z (25,985 seconds behind). Newly built envelopes could therefore be expired before wallet approval. Slow simulation or approval could also consume the original three-minute window. Proof generation occurs before this window starts.

The reported transfer returned `txTooLate`, a transaction validity rejection. The exact rejected envelope was unavailable from Horizon, so its specific bounds were not independently inspected. Read-only proof simulations do not test submitted transaction time bounds; previous verifier acceptance did not cover this failure.

## Change

Use RPC ledger-close time, cached for at most 20 seconds with monotonic elapsed time, for five-minute validity bounds. Obtain that metadata from a NOT_FOUND transaction lookup; this avoids decoding ledger XDR that the pinned SDK cannot parse on the current network. Fail closed if metadata is unavailable. Refresh the unsigned bounds after simulation, preserving the transaction body, fees, Soroban data, operation authorizations and sequence. Check expiry again after wallet approval, with a ten-second margin. Never automatically sign or submit a replacement.

Restoration uses the same clock. The UI identifies expiry as a definitive rejection rather than an ambiguous confirmation timeout. Existing ambiguous-submission handling is preserved.

## Verification

- SDK fast suite passed; optional live indexer parity skipped because no indexer is configured.
- New regression tests cover ledger time seven hours ahead/behind the device, unchanged fees/sequence/Soroban data, delayed wallet approval, missing clock metadata and failed metadata requests. Expired envelopes are never sent.
- App form/network/progress/worker tests passed.
- Production app build and SDK typecheck passed.
- Read-only clock probe against the configured Testnet RPC confirmed the skew. No payment was signed or submitted during this verification.

The local production server was rebuilt and restarted on the same localhost origin. Refresh the browser before retrying. Browser storage must be retained. Live wallet-approved settlement remains to be verified; no contract redeployment is required. Hosted deployments need the updated application build.
