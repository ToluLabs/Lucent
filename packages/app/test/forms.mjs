import assert from "node:assert/strict";
import {
  toBaseUnits,
  validPayment,
  sanitizeAmount,
  formatAmount,
} from "../lib/amount.ts";
import { transactionError } from "../lib/action-result.ts";
import { escrowTransferDescription } from "../lib/escrow-activity.ts";
import { EscrowState } from "@lucent/sdk";

const selfEscrow = { depositor: "me", recipient: "me", arbiter: null, createdAt: 0n, timeoutAt: 1n, completedAt: 0n };
assert.equal(escrowTransferDescription({ ...selfEscrow, state: EscrowState.Released }, "me", true).label, "Escrow released to you");
assert.equal(escrowTransferDescription({ ...selfEscrow, state: EscrowState.Refunded }, "me", true).label, "Escrow refunded to you");
assert.equal(escrowTransferDescription({ ...selfEscrow, state: EscrowState.Funded }, "me", true).label, "Received from escrow");
assert.equal(escrowTransferDescription({ ...selfEscrow, state: EscrowState.Funded }, "me", false).label, "Escrow funded");
assert.equal(escrowTransferDescription({ ...selfEscrow, recipient: "other", state: EscrowState.Released }, "me", true).label, "Received from escrow");
assert.equal(toBaseUnits("0.0000001"), 1n);
assert.equal(toBaseUnits("1234567890123456.1234567"), 12345678901234561234567n);
for (const value of ["1.2.3", "-1", "1e7", "Infinity", "1.00000001", "NaN"])
  assert.throws(() => toBaseUnits(value));
assert.equal(validPayment("0", 10n), false);
assert.equal(validPayment(".", 10n), false);
assert.equal(validPayment("0.0000001", 1n), true);
assert.equal(validPayment("0.0000002", 1n), false);
assert.equal(validPayment("1.00000001", 999999999n), false);
assert.equal(formatAmount(123456789n, 7), "12.3456789");
assert.equal(sanitizeAmount("1.2345678"), "1.2345678");
const hash = "a".repeat(64);
const timeout = transactionError(
  `transfer confirmation timed out (tx ${hash})`,
);
assert.equal(timeout.uncertain, true);
assert.equal(timeout.hash, hash);
assert.equal(
  transactionError("User declined wallet approval").uncertain,
  false,
);
assert.equal(
  transactionError("send register rejected (txSorobanInvalid)").uncertain,
  false,
);
assert.equal(transactionError("failed to fetch").uncertain, true);
assert.equal(
  transactionError("Wrong network").title,
  "Switch to Stellar Testnet",
);
assert.equal(transactionError("Account not found: GTEST").title, "Fund your Testnet wallet first");
assert.equal(transactionError("Your wallet is not funded on Stellar Testnet.").uncertain, false);
console.log(
  "Financial amount precision, validation and error classification passed.",
);
