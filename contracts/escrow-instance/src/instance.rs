//! A single confidential escrow. Deployed once per escrow by
//! [`PrivateEscrowFactory`](crate::PrivateEscrowFactory); its own address is its
//! confidential account.

use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, Address, Bytes, Env, String,
};

use crate::{Error, Escrow, EscrowState, TokenClient, RELEASE_WINDOW};

#[contracttype]
enum DataKey {
    Token,
    Escrow,
    /// Pre-generated payout proof: instance -> recipient.
    ReleaseProof,
    /// Pre-generated payout proof: instance -> depositor.
    RefundProof,
    RegisterData,
    AuditorId,
    TransferIn,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Funded {}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Completed {
    pub by: Address,
    pub proof_uri: String,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Released {}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Disputed {
    pub by: Address,
    pub proof_uri: String,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Refunded {}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Cancelled {}

#[contract]
pub struct PrivateEscrowInstance;

#[contractimpl]
impl PrivateEscrowInstance {
    /// Deployed by the factory. `timeout_seconds` counts from now; after it, the
    /// depositor may self-refund while still `Funded`.
    pub fn __constructor(
        e: &Env,
        token: Address,
        depositor: Address,
        recipient: Address,
        arbiter: Option<Address>,
        timeout_seconds: u64,
    ) {
        let now = e.ledger().timestamp();
        e.storage().instance().set(&DataKey::Token, &token);
        e.storage().instance().set(
            &DataKey::Escrow,
            &Escrow {
                depositor,
                recipient,
                arbiter,
                state: EscrowState::Created,
                created_at: now,
                timeout_at: now + timeout_seconds,
                completed_at: 0,
            },
        );
    }

    /// Prepare immutable inputs for payout validation. Re-preparing invalidates
    /// both previously checked proofs. No token registration or funds move yet.
    pub fn prepare_funding(
        e: &Env,
        register_data: Bytes,
        auditor_id: u32,
        transfer_in: Bytes,
    ) -> Result<(), Error> {
        let esc = get(e);
        esc.depositor.require_auth();
        if esc.state != EscrowState::Created {
            return Err(Error::BadState);
        }
        e.storage()
            .instance()
            .set(&DataKey::RegisterData, &register_data);
        e.storage().instance().set(&DataKey::AuditorId, &auditor_id);
        e.storage()
            .instance()
            .set(&DataKey::TransferIn, &transfer_in);
        e.storage().instance().remove(&DataKey::ReleaseProof);
        e.storage().instance().remove(&DataKey::RefundProof);
        Ok(())
    }

    /// Verify one settlement branch against the EXACT prepared funding inputs
    /// before storing it. One proof per call keeps transaction size and proving
    /// verification cost bounded. A rejected proof never enables funding.
    pub fn store_payout_proof(
        e: &Env,
        release: bool,
        proof: Bytes,
        remaining_blinding: soroban_sdk::BytesN<32>,
    ) -> Result<(), Error> {
        let esc = get(e);
        esc.depositor.require_auth();
        if esc.state != EscrowState::Created {
            return Err(Error::BadState);
        }
        let register_data: Bytes = e
            .storage()
            .instance()
            .get(&DataKey::RegisterData)
            .ok_or(Error::FundingNotPrepared)?;
        let auditor_id: u32 = e.storage().instance().get(&DataKey::AuditorId).unwrap();
        let transfer_in: Bytes = e.storage().instance().get(&DataKey::TransferIn).unwrap();
        let to = if release {
            &esc.recipient
        } else {
            &esc.depositor
        };
        if !token(e).verify_escrow_payout(
            &register_data,
            &auditor_id,
            &transfer_in,
            to,
            &proof,
            &remaining_blinding,
        ) {
            return Err(Error::InvalidPayoutProof);
        }
        let key = if release {
            DataKey::ReleaseProof
        } else {
            DataKey::RefundProof
        };
        e.storage().instance().set(&key, &proof);
        Ok(())
    }

    /// Execute the prepared funding only after BOTH payout proofs passed.
    /// Registration, transfer and merge are atomic: nobody can inject a credit
    /// between registration and this one merge. Later credits stay in receiving
    /// and cannot invalidate the frozen spendable commitment used at settlement.
    pub fn fund(e: &Env) -> Result<(), Error> {
        let mut esc = get(e);
        esc.depositor.require_auth();
        if esc.state != EscrowState::Created {
            return Err(Error::BadState);
        }
        if !e.storage().instance().has(&DataKey::ReleaseProof)
            || !e.storage().instance().has(&DataKey::RefundProof)
        {
            return Err(Error::PayoutProofsMissing);
        }
        let register_data: Bytes = e.storage().instance().get(&DataKey::RegisterData).unwrap();
        let auditor_id: u32 = e.storage().instance().get(&DataKey::AuditorId).unwrap();
        let transfer_in: Bytes = e.storage().instance().get(&DataKey::TransferIn).unwrap();
        let token = token(e);
        let this = e.current_contract_address();
        token.register(&this, &auditor_id, &register_data);
        token.confidential_transfer(&esc.depositor, &this, &transfer_in);
        token.merge(&this);

        e.storage().instance().remove(&DataKey::RegisterData);
        e.storage().instance().remove(&DataKey::TransferIn);
        e.storage().instance().remove(&DataKey::AuditorId);
        esc.state = EscrowState::Funded;
        put(e, &esc);
        Funded {}.publish(e);
        Ok(())
    }

    /// Recipient marks delivery; starts the release window, blocks timeout.
    /// State: Funded -> Completed.
    pub fn mark_completed(e: &Env, proof_uri: String) -> Result<(), Error> {
        let mut esc = get(e);
        esc.recipient.require_auth();
        if esc.state != EscrowState::Funded {
            return Err(Error::BadState);
        }
        esc.state = EscrowState::Completed;
        esc.completed_at = e.ledger().timestamp();
        put(e, &esc);
        Completed {
            by: esc.recipient,
            proof_uri,
        }
        .publish(e);
        Ok(())
    }

    /// Depositor releases to the recipient. Callable from Funded (early) or
    /// Completed (normal). State: -> Released.
    pub fn release(e: &Env) -> Result<(), Error> {
        let mut esc = get(e);
        esc.depositor.require_auth();
        if esc.state != EscrowState::Funded && esc.state != EscrowState::Completed {
            return Err(Error::BadState);
        }
        esc.state = EscrowState::Released;
        put(e, &esc);
        payout(e, &recipient_proof(e), &esc.recipient);
        Released {}.publish(e);
        Ok(())
    }

    /// Recipient escalates to the arbiter after the release window. Requires an
    /// arbiter. State: Completed -> Disputed.
    pub fn dispute_with_proof(e: &Env, proof_uri: String) -> Result<(), Error> {
        let mut esc = get(e);
        esc.recipient.require_auth();
        if esc.state != EscrowState::Completed {
            return Err(Error::BadState);
        }
        if e.ledger().timestamp() < esc.completed_at + RELEASE_WINDOW {
            return Err(Error::ReleaseWindowActive);
        }
        if esc.arbiter.is_none() {
            return Err(Error::NoArbiter);
        }
        esc.state = EscrowState::Disputed;
        put(e, &esc);
        Disputed {
            by: esc.recipient,
            proof_uri,
        }
        .publish(e);
        Ok(())
    }

    /// Recipient auto-claims when there is no arbiter and the release window has
    /// expired. State: Completed -> Released.
    pub fn claim_after_window(e: &Env) -> Result<(), Error> {
        let mut esc = get(e);
        esc.recipient.require_auth();
        if esc.state != EscrowState::Completed {
            return Err(Error::BadState);
        }
        if e.ledger().timestamp() < esc.completed_at + RELEASE_WINDOW {
            return Err(Error::ReleaseWindowActive);
        }
        if esc.arbiter.is_some() {
            return Err(Error::ArbiterSet);
        }
        esc.state = EscrowState::Released;
        put(e, &esc);
        payout(e, &recipient_proof(e), &esc.recipient);
        Released {}.publish(e);
        Ok(())
    }

    /// Arbiter awards the escrow to the recipient. State: Disputed -> Released.
    pub fn resolve_to_recipient(e: &Env) -> Result<(), Error> {
        let mut esc = get(e);
        let arbiter = esc.arbiter.clone().ok_or(Error::NoArbiter)?;
        arbiter.require_auth();
        if esc.state != EscrowState::Disputed {
            return Err(Error::BadState);
        }
        esc.state = EscrowState::Released;
        put(e, &esc);
        payout(e, &recipient_proof(e), &esc.recipient);
        Released {}.publish(e);
        Ok(())
    }

    /// Arbiter returns the escrow to the depositor. State: Disputed -> Refunded.
    pub fn resolve_to_depositor(e: &Env) -> Result<(), Error> {
        let mut esc = get(e);
        let arbiter = esc.arbiter.clone().ok_or(Error::NoArbiter)?;
        arbiter.require_auth();
        if esc.state != EscrowState::Disputed {
            return Err(Error::BadState);
        }
        esc.state = EscrowState::Refunded;
        put(e, &esc);
        payout(e, &depositor_proof(e), &esc.depositor);
        Refunded {}.publish(e);
        Ok(())
    }

    /// Depositor reclaims a still-`Funded` escrow after timeout. Blocked once the
    /// recipient marks completed. State: Funded -> Refunded.
    pub fn timeout(e: &Env) -> Result<(), Error> {
        let mut esc = get(e);
        esc.depositor.require_auth();
        if esc.state != EscrowState::Funded {
            return Err(Error::BadState);
        }
        if e.ledger().timestamp() < esc.timeout_at {
            return Err(Error::TooEarly);
        }
        esc.state = EscrowState::Refunded;
        put(e, &esc);
        payout(e, &depositor_proof(e), &esc.depositor);
        Refunded {}.publish(e);
        Ok(())
    }

    /// Cancel an unfunded shell. State: Created -> Cancelled.
    pub fn cancel(e: &Env) -> Result<(), Error> {
        let mut esc = get(e);
        esc.depositor.require_auth();
        if esc.state != EscrowState::Created {
            return Err(Error::BadState);
        }
        esc.state = EscrowState::Cancelled;
        put(e, &esc);
        Cancelled {}.publish(e);
        Ok(())
    }

    // ---- views -------------------------------------------------------------

    pub fn get_escrow(e: &Env) -> Escrow {
        get(e)
    }

    pub fn token(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Token).unwrap()
    }
}

// ---- helpers ---------------------------------------------------------------

fn get(e: &Env) -> Escrow {
    e.storage().instance().get(&DataKey::Escrow).unwrap()
}

fn put(e: &Env, esc: &Escrow) {
    e.storage().instance().set(&DataKey::Escrow, esc);
}

fn token(e: &Env) -> TokenClient<'_> {
    TokenClient::new(e, &e.storage().instance().get(&DataKey::Token).unwrap())
}

fn recipient_proof(e: &Env) -> Bytes {
    e.storage().instance().get(&DataKey::ReleaseProof).unwrap()
}

fn depositor_proof(e: &Env) -> Bytes {
    e.storage().instance().get(&DataKey::RefundProof).unwrap()
}

/// Spend only the commitment fixed during funding, using the selected
/// pre-verified proof. Unsolicited credits remain isolated in receiving.
/// `from` is this contract, which authorizes by invocation.
fn payout(e: &Env, proof: &Bytes, to: &Address) {
    let token = token(e);
    let this = e.current_contract_address();
    token.confidential_transfer(&this, to, proof);
}
