//! PrivateEscrow instance — one two-party confidential escrow on Stellar.
//!
//! A confidential balance is keyed by *contract address*, so one contract can
//! hold exactly one isolated confidential balance. Escrow therefore uses a
//! **factory** (the `private-escrow-factory-contract` crate) that deploys one
//! instance of this contract per escrow:
//!
//! * Each instance is its own contract address, hence its own confidential
//!   account with an isolated balance.
//! * The instance is funded by the depositor's `confidential_transfer` into it,
//!   and pays out with a `confidential_transfer` where `from` is the instance
//!   itself — a contract authorizes its own outgoing transfer by invocation, so
//!   the recipient or arbiter can trigger a payout without holding any key.
//! * The depositor prepares registration + funding inputs, then submits each
//!   payout proof for on-chain verification against that future commitment.
//!   Only after both branches validate can `fund` atomically register, receive
//!   and merge the exact prepared transfer. Settlement never merges later credits.
//!   Four transactions keep proof payloads within the transaction size limit.
//!
//! # Trust caveat
//!
//! The depositor derives the instance's Grumpkin secret to build those payout
//! proofs and must discard it afterwards; a depositor who retains it could
//! re-spend the escrowed balance and invalidate both stored proofs. Acceptable
//! for a testnet demo, not for production.
//!
//! # ⚠️ Not Production Ready
//!
//! Built on the unaudited confidential-token demo. Testnet only.
#![no_std]

use soroban_sdk::{contractclient, contracterror, contracttype, Address, Bytes, Env};

mod instance;

pub use instance::{PrivateEscrowInstance, PrivateEscrowInstanceClient};

/// Minimal cross-contract view of the confidential token used by an instance.
#[contractclient(name = "TokenClient")]
pub trait ConfidentialTokenInterface {
    fn register(env: Env, account: Address, auditor_id: u32, data: Bytes);
    fn confidential_transfer(env: Env, from: Address, to: Address, data: Bytes);
    fn merge(env: Env, account: Address);
    fn verify_escrow_payout(
        env: Env,
        register_data: Bytes,
        auditor_id: u32,
        transfer_in: Bytes,
        to: Address,
        data: Bytes,
        remaining_blinding: soroban_sdk::BytesN<32>,
    ) -> bool;
}

#[contracterror]
#[derive(Copy, Clone, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum Error {
    NotDepositor = 1,
    NotRecipient = 2,
    NotArbiter = 3,
    BadState = 4,
    ReleaseWindowActive = 5,
    NoArbiter = 6,
    ArbiterSet = 7,
    TooEarly = 8,
    NotFound = 9,
    /// Both payout branches must be verified before `fund`.
    PayoutProofsMissing = 10,
    FundingNotPrepared = 11,
    InvalidPayoutProof = 12,
}

/// Lifecycle of an escrow, mirroring the Solidity reference exactly.
#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum EscrowState {
    /// Shell created, not yet funded.
    Created = 0,
    /// Depositor locked funds; timeout active.
    Funded = 1,
    /// Recipient marked delivery; release window active; timeout blocked.
    Completed = 2,
    /// Funds sent to recipient.
    Released = 3,
    /// Arbiter called in.
    Disputed = 4,
    /// Funds returned to depositor.
    Refunded = 5,
    /// Cancelled before funding.
    Cancelled = 6,
}

/// Read model of an escrow instance.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Escrow {
    pub depositor: Address,
    pub recipient: Address,
    pub arbiter: Option<Address>,
    pub state: EscrowState,
    pub created_at: u64,
    pub timeout_at: u64,
    pub completed_at: u64,
}

/// Time the depositor has to release after the recipient marks completed
/// (10 minutes), matching `PrivateEscrow.sol`'s `RELEASE_WINDOW`.
pub const RELEASE_WINDOW: u64 = 600;

#[cfg(test)]
mod test;
