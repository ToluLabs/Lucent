import assert from "node:assert/strict";
import {
  toBaseUnits,
  validPayment,
  sanitizeAmount,
  formatAmount,
} from "../lib/amount.ts";
import { transactionError } from "../lib/action-result.ts";
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
console.log(
  "Financial amount precision, validation and error classification passed.",
);
