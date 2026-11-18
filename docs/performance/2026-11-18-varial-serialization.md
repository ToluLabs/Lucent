# Varial 5.52.0 payroll signing failure

Status: root cause reproduced; proposed upstream fix tested; live payroll remains blocked. This report and patch have not been published or sent to maintainers.

## Observed behavior

The user approved a payroll execution in Varial. Lucent received error code -4 instead of a signed transaction. A controlled repeat with the wallet background console attached captured:

```
RangeError: Maximum call stack size exceeded
  at n (background.min.js:2:3146671)
  at z (background.min.js:2:3872468)
  at d.toXdr (background.min.js:2:3870220)
  at A.toXdr (background.min.js:2:3131563)
  at signTransaction.ts:74:36
```

The signing popup showed the intended account, Test Net, and an enabled Confirm button. After user confirmation it closed and the application received -4. The signed envelope was not returned to Lucent. This was not a payroll contract rejection.

Two preceding restoration transactions confirmed successfully:

- [d401cfc…253b123](https://stellar.expert/explorer/testnet/tx/d401cfc020892b67c082b9f4e8638df9f7f5cec1a69915c319292c64a253b123)
- [be028f0…430668d](https://stellar.expert/explorer/testnet/tx/be028f0bf88203d2c509cebddb6f548e3322d3022b1a77d377f4e61cc430668d)

The read-only contract check during diagnosis returned run #7 status 1 (`Funded` / ready to pay), executed_at 0. Restoration is not evidence of salary settlement.

## Cause

The installed extension is version 5.52.0. The public Chrome Web Store CRX independently downloaded for source inspection also reports 5.52.0. Its bundled function at the captured crash location encodes base64 by passing a chunk of up to 65,535 bytes as arguments to `String.fromCharCode.apply`.

The matching SDK is `@stellar/stellar-sdk` 17.4.0. The published Varial version's [source dependency declaration](https://github.com/stellar/freighter/blob/4ef528c6318c/extension/package.json) names that version. The [upstream base64 encoder](https://github.com/stellar/js-stellar-sdk/blob/main/src/base/util/base64.ts) uses the same chunk size. The wallet [signing handler](https://github.com/stellar/freighter/blob/master/extension/src/background/messageListener/handlers/signTransaction.ts) serializes the signed envelope; the [popup signing flow](https://github.com/stellar/freighter/blob/master/extension/src/popup/helpers/useSetupSigningFlow.ts) closes afterward. The [background listener](https://github.com/stellar/freighter/blob/master/extension/src/background/messageListener/freighterApiMessageListener.ts) resolves a pending request as declined when the popup closes without a successful result. Current upstream links can change; the installed stack and public CRX were inspected directly.

Passing that many arguments exceeds the tested browser worker's call-stack capacity. An isolated Chrome dedicated-worker test of the actual upstream SDK encoder reproduced the same RangeError. This test does not attach to the user's browser or extension. The exact failing payroll envelope byte count was not captured; the application now includes operation name and envelope byte count in future signing errors.

## Reproduction and candidate patch

Use Node 22+ for the upstream SDK's declared engine requirement. Install its test dependency outside the repository:

```sh
npm install --prefix /tmp/lucent-wallet-compat --no-audit --no-fund @stellar/stellar-sdk@17.4.0
PERF_REPORT=/tmp/varial-serialization-worker.json node scripts/diagnostics/varial-serialization.mjs
```

The harness defaults to Google Chrome's standard macOS path. Set `CHROME_PATH` to another installed Chrome executable when needed. Set `VARIAL_REPRO_DIR` if using a different temporary dependency directory. It uses Lucent's existing esbuild and Playwright test dependencies. Only synthetic patterned bytes are encoded and decoded; there are no keys, proofs, wallet calls or transactions.

Measured in the same disposable Chrome worker:

| Encoder | Result |
| --- | --- |
| Original SDK | 9/15 sizes round-tripped; 65,534 bytes and the larger tested sizes failed with RangeError |
| Candidate patch | 15/15 sizes from 1 byte through 1,000,000 bytes round-tripped identically |

60,000 bytes passed in this environment. This is an observation, not a portable wallet size limit. Call-stack limits vary by runtime and call depth.

[Raw results](varial-serialization-worker.json) and [candidate upstream patch](varial-base64-chunk.patch) are included. The harness applies the patch only to its isolated test bundle. It reduces the encoding chunk to 16,383 bytes. This size is divisible by three, preserving correct concatenated base64 without padding between chunks. Tests include chunk boundaries and compare every decoded byte.

The patch must be reviewed, incorporated and released by the SDK/wallet maintainers, then validated in Varial's actual extension signing path. The isolated worker test is not a completed wallet release or a live payroll settlement test.

## Lucent implications

Lucent's own SDK dependency remains unchanged. Updating it cannot repair code bundled inside an installed extension. No wallet code or browser primitives were modified. No payroll was automatically divided into separate payments, and transaction authorization and proof requirements remain intact.

Until a compatible wallet release/signing integration is available, large payroll envelopes can remain blocked in this wallet. Repeated approvals do not resolve the serialization failure. Single-recipient payroll or individual transfers would be separate user-authorized operations with different settlement semantics; they are not an automatic substitute for the existing atomic run.
