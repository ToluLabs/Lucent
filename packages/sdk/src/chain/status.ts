/** Lightweight public lifecycle constants; no cryptography, RPC or proving imports. */
export enum RunStatus {
  Scheduled = 0,
  Funded = 1,
  Executed = 2,
  Cancelled = 3,
}

export enum EscrowState {
  Created = 0,
  Funded = 1,
  Completed = 2,
  Released = 3,
  Disputed = 4,
  Refunded = 5,
  Cancelled = 6,
}
