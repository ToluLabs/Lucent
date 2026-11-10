export const DECIMALS = 7;
export const SCALE = 10_000_000n;
export const SYMBOL = "USDC";

export function toBaseUnits(display: string): bigint {
  if (!display || display === ".") return 0n;
  if (!/^\d*(?:\.\d{0,7})?$/.test(display))
    throw new Error("Enter a valid amount with at most 7 decimal places.");
  const [whole, frac = ""] = display.split(".");
  const fracPadded = frac.padEnd(DECIMALS, "0").slice(0, DECIMALS);
  return BigInt(whole || "0") * SCALE + BigInt(fracPadded || "0");
}

export function fromBaseUnits(raw: bigint): string {
  const whole = raw / SCALE;
  const frac = raw % SCALE;
  return `${whole}.${frac.toString().padStart(DECIMALS, "0")}`;
}

export function formatAmount(raw: bigint, maxDecimals = 2): string {
  const [whole, frac] = fromBaseUnits(raw).split(".");
  const trimmed = (frac ?? "").slice(0, maxDecimals).replace(/0+$/, "") || "0";
  return `${whole}.${trimmed}`;
}

export function displayAmount(raw: bigint, maxDecimals = 2): string {
  return `${formatAmount(raw, maxDecimals)} ${SYMBOL}`;
}

/** Preserve decimal precision without floating point arithmetic. */
export function sanitizeAmount(value: string): string {
  return /^\d*(?:\.\d{0,7})?$/.test(value) ? value : "";
}
export function validPayment(value: string, available: bigint): boolean {
  try {
    const amount = toBaseUnits(value);
    return amount > 0n && amount <= available;
  } catch {
    return false;
  }
}
