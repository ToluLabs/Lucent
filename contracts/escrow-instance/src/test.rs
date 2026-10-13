#![cfg(test)]

use soroban_sdk::{
    contract, contractimpl, symbol_short, testutils::Address as _, testutils::Ledger as _, Address,
    Bytes, Env, String, Vec,
};

use crate::{
    Error, EscrowState, PrivateEscrowInstance, PrivateEscrowInstanceClient, RELEASE_WINDOW,
};

// ---- mock confidential token -----------------------------------------------

#[contract]
pub struct MockToken;

#[contractimpl]
impl MockToken {
    pub fn register(e: &Env, account: Address, _auditor_id: u32, _data: Bytes) {
        account.require_auth();
        e.storage()
            .instance()
            .set(&(symbol_short!("spend"), account.clone()), &0u32);
        e.storage()
            .instance()
            .set(&(symbol_short!("receive"), account), &0u32);
    }

    pub fn verify_escrow_payout(
        _e: &Env,
        _register_data: Bytes,
        _auditor_id: u32,
        transfer_in: Bytes,
        _to: Address,
        data: Bytes,
        _remaining_blinding: soroban_sdk::BytesN<32>,
    ) -> bool {
        !data.is_empty() && data == transfer_in
    }

    pub fn credit(e: &Env, account: Address, amount: u32) {
        let key = (symbol_short!("receive"), account);
        let prior: u32 = e.storage().instance().get(&key).unwrap_or(0);
        e.storage().instance().set(&key, &(prior + amount));
    }

    pub fn confidential_transfer(e: &Env, from: Address, to: Address, data: Bytes) {
        from.require_auth();
        // Model a proof bound to the sender's original commitment. Any later
        // merge of unsolicited credits makes this check fail.
        let key = (symbol_short!("spend"), from.clone());
        if let Some(spend) = e.storage().instance().get::<_, u32>(&key) {
            assert_eq!(spend, data.get(0).unwrap() as u32);
            e.storage().instance().set(&key, &0u32);
        }
        Self::credit(e, to.clone(), data.get(0).unwrap() as u32);
        let mut log: Vec<(Address, Address)> = e
            .storage()
            .instance()
            .get(&symbol_short!("xfers"))
            .unwrap_or(Vec::new(e));
        log.push_back((from, to));
        e.storage().instance().set(&symbol_short!("xfers"), &log);
    }

    pub fn merge(e: &Env, account: Address) {
        account.require_auth();
        let spend_key = (symbol_short!("spend"), account.clone());
        let receive_key = (symbol_short!("receive"), account);
        let spend: u32 = e.storage().instance().get(&spend_key).unwrap_or(0);
        let receive: u32 = e.storage().instance().get(&receive_key).unwrap_or(0);
        e.storage().instance().set(&spend_key, &(spend + receive));
        e.storage().instance().set(&receive_key, &0u32);
    }

    pub fn xfers(e: &Env) -> Vec<(Address, Address)> {
        e.storage()
            .instance()
            .get(&symbol_short!("xfers"))
            .unwrap_or(Vec::new(e))
    }
}

// ---- fixtures --------------------------------------------------------------

const TIMEOUT: u64 = 3600;

struct Fixture {
    e: Env,
    token: Address,
    escrow: PrivateEscrowInstanceClient<'static>,
    depositor: Address,
    recipient: Address,
    arbiter: Option<Address>,
}

fn setup(with_arbiter: bool) -> Fixture {
    let e = Env::default();
    e.mock_all_auths();
    let token = e.register(MockToken, ());
    let depositor = Address::generate(&e);
    let recipient = Address::generate(&e);
    let arbiter = if with_arbiter {
        Some(Address::generate(&e))
    } else {
        None
    };
    let id = e.register(
        PrivateEscrowInstance,
        (
            token.clone(),
            depositor.clone(),
            recipient.clone(),
            arbiter.clone(),
            TIMEOUT,
        ),
    );
    let escrow = PrivateEscrowInstanceClient::new(&e, &id);
    Fixture {
        e,
        token,
        escrow,
        depositor,
        recipient,
        arbiter,
    }
}

fn b(f: &Fixture) -> Bytes {
    Bytes::from_array(&f.e, &[9u8; 8])
}

fn fund(f: &Fixture) {
    f.escrow.prepare_funding(&b(f), &0u32, &b(f));
    f.escrow.store_payout_proof(
        &true,
        &b(f),
        &soroban_sdk::BytesN::from_array(&f.e, &[0; 32]),
    );
    f.escrow.store_payout_proof(
        &false,
        &b(f),
        &soroban_sdk::BytesN::from_array(&f.e, &[0; 32]),
    );
    f.escrow.fund();
}

fn advance_past_window(f: &Fixture, completed_at: u64) {
    f.e.ledger()
        .set_timestamp(completed_at + RELEASE_WINDOW + 1);
}

fn last_payout_to(f: &Fixture) -> Address {
    let xfers = MockTokenClient::new(&f.e, &f.token).xfers();
    let (_, to) = xfers.get(xfers.len() - 1).unwrap();
    to
}

// ---- happy paths -----------------------------------------------------------

#[test]
fn fund_moves_to_funded() {
    let f = setup(false);
    fund(&f);
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Funded);
    // funding transfers depositor -> instance.
    let xfers = MockTokenClient::new(&f.e, &f.token).xfers();
    assert_eq!(xfers.len(), 1);
    assert_eq!(xfers.get(0).unwrap().0, f.depositor);
    assert_eq!(xfers.get(0).unwrap().1, f.escrow.address);
}

#[test]
fn normal_release_pays_recipient() {
    let f = setup(false);
    fund(&f);
    f.escrow
        .mark_completed(&String::from_str(&f.e, "ipfs://proof"));
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Completed);
    f.escrow.release();
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Released);
    assert_eq!(last_payout_to(&f), f.recipient);
}

#[test]
fn early_release_from_funded() {
    let f = setup(false);
    fund(&f);
    f.escrow.release();
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Released);
    assert_eq!(last_payout_to(&f), f.recipient);
}

#[test]
fn claim_after_window_no_arbiter() {
    let f = setup(false);
    fund(&f);
    f.escrow.mark_completed(&String::from_str(&f.e, "x"));
    let completed_at = f.escrow.get_escrow().completed_at;
    advance_past_window(&f, completed_at);
    f.escrow.claim_after_window();
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Released);
    assert_eq!(last_payout_to(&f), f.recipient);
}

#[test]
fn dispute_then_resolve_to_recipient() {
    let f = setup(true);
    fund(&f);
    f.escrow.mark_completed(&String::from_str(&f.e, "x"));
    let completed_at = f.escrow.get_escrow().completed_at;
    advance_past_window(&f, completed_at);
    f.escrow
        .dispute_with_proof(&String::from_str(&f.e, "evidence"));
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Disputed);
    f.escrow.resolve_to_recipient();
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Released);
    assert_eq!(last_payout_to(&f), f.recipient);
}

#[test]
fn dispute_then_resolve_to_depositor() {
    let f = setup(true);
    fund(&f);
    f.escrow.mark_completed(&String::from_str(&f.e, "x"));
    let completed_at = f.escrow.get_escrow().completed_at;
    advance_past_window(&f, completed_at);
    f.escrow
        .dispute_with_proof(&String::from_str(&f.e, "evidence"));
    f.escrow.resolve_to_depositor();
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Refunded);
    assert_eq!(last_payout_to(&f), f.depositor);
}

#[test]
fn timeout_refunds_depositor() {
    let f = setup(false);
    fund(&f);
    f.e.ledger().set_timestamp(TIMEOUT + 1);
    f.escrow.timeout();
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Refunded);
    assert_eq!(last_payout_to(&f), f.depositor);
}

#[test]
fn cancel_unfunded() {
    let f = setup(false);
    f.escrow.cancel();
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Cancelled);
}

// ---- guards ----------------------------------------------------------------

#[test]
fn cannot_fund_twice() {
    let f = setup(false);
    fund(&f);
    let res = f.escrow.try_fund();
    assert_eq!(res, Err(Ok(Error::BadState)));
}

#[test]
fn fund_before_payout_proofs_blocked() {
    let f = setup(false);
    let res = f.escrow.try_fund();
    assert_eq!(res, Err(Ok(Error::PayoutProofsMissing)));
}

#[test]
fn preparing_again_invalidates_both_payout_proofs() {
    let f = setup(false);
    f.escrow.prepare_funding(&b(&f), &0u32, &b(&f));
    f.escrow.store_payout_proof(
        &true,
        &b(&f),
        &soroban_sdk::BytesN::from_array(&f.e, &[0; 32]),
    );
    f.escrow.store_payout_proof(
        &false,
        &b(&f),
        &soroban_sdk::BytesN::from_array(&f.e, &[0; 32]),
    );
    f.escrow.prepare_funding(&b(&f), &1u32, &b(&f));
    assert_eq!(f.escrow.try_fund(), Err(Ok(Error::PayoutProofsMissing)));
}

#[test]
fn mark_completed_requires_funded() {
    let f = setup(false);
    let res = f.escrow.try_mark_completed(&String::from_str(&f.e, "x"));
    assert_eq!(res, Err(Ok(Error::BadState)));
}

#[test]
fn claim_before_window_blocked() {
    let f = setup(false);
    fund(&f);
    f.escrow.mark_completed(&String::from_str(&f.e, "x"));
    let res = f.escrow.try_claim_after_window();
    assert_eq!(res, Err(Ok(Error::ReleaseWindowActive)));
}

#[test]
fn claim_after_window_blocked_when_arbiter_set() {
    let f = setup(true);
    fund(&f);
    f.escrow.mark_completed(&String::from_str(&f.e, "x"));
    let completed_at = f.escrow.get_escrow().completed_at;
    advance_past_window(&f, completed_at);
    let res = f.escrow.try_claim_after_window();
    assert_eq!(res, Err(Ok(Error::ArbiterSet)));
}

#[test]
fn dispute_without_arbiter_blocked() {
    let f = setup(false);
    fund(&f);
    f.escrow.mark_completed(&String::from_str(&f.e, "x"));
    let completed_at = f.escrow.get_escrow().completed_at;
    advance_past_window(&f, completed_at);
    let res = f
        .escrow
        .try_dispute_with_proof(&String::from_str(&f.e, "x"));
    assert_eq!(res, Err(Ok(Error::NoArbiter)));
}

#[test]
fn timeout_too_early() {
    let f = setup(false);
    fund(&f);
    let res = f.escrow.try_timeout();
    assert_eq!(res, Err(Ok(Error::TooEarly)));
}

#[test]
fn timeout_blocked_after_completed() {
    let f = setup(false);
    fund(&f);
    f.escrow.mark_completed(&String::from_str(&f.e, "x"));
    f.e.ledger().set_timestamp(TIMEOUT + 1);
    // State is Completed, not Funded -> timeout is blocked.
    let res = f.escrow.try_timeout();
    assert_eq!(res, Err(Ok(Error::BadState)));
    let _ = f.arbiter;
}

// ---- auth ------------------------------------------------------------------

#[test]
#[should_panic]
fn stranger_cannot_mark_completed() {
    let e = Env::default();
    let token = e.register(MockToken, ());
    let depositor = Address::generate(&e);
    let recipient = Address::generate(&e);
    let id = e.register(
        PrivateEscrowInstance,
        (
            token,
            depositor.clone(),
            recipient,
            None::<Address>,
            TIMEOUT,
        ),
    );
    let escrow = PrivateEscrowInstanceClient::new(&e, &id);

    e.mock_all_auths();
    let blob = Bytes::from_array(&e, &[1]);
    escrow.prepare_funding(&blob, &0u32, &blob);
    escrow.store_payout_proof(&true, &blob, &soroban_sdk::BytesN::from_array(&e, &[0; 32]));
    escrow.store_payout_proof(
        &false,
        &blob,
        &soroban_sdk::BytesN::from_array(&e, &[0; 32]),
    );
    escrow.fund();

    // Real auth required now: nobody authorized as the recipient.
    e.set_auths(&[]);
    escrow.mark_completed(&String::from_str(&e, "x"));
}

#[test]
fn invalid_release_proof_cannot_enable_funding() {
    let f = setup(false);
    f.escrow.prepare_funding(&b(&f), &0u32, &b(&f));
    f.escrow.store_payout_proof(
        &false,
        &b(&f),
        &soroban_sdk::BytesN::from_array(&f.e, &[0; 32]),
    );
    assert_eq!(
        f.escrow.try_store_payout_proof(
            &true,
            &Bytes::new(&f.e),
            &soroban_sdk::BytesN::from_array(&f.e, &[0; 32])
        ),
        Err(Ok(Error::InvalidPayoutProof))
    );
    assert_eq!(f.escrow.try_fund(), Err(Ok(Error::PayoutProofsMissing)));
    assert_eq!(f.escrow.get_escrow().state, EscrowState::Created);
    assert!(MockTokenClient::new(&f.e, &f.token).xfers().is_empty());
    // A corrected proof can be submitted before funding, with no funds at risk.
    f.escrow.store_payout_proof(
        &true,
        &b(&f),
        &soroban_sdk::BytesN::from_array(&f.e, &[0; 32]),
    );
    f.escrow.fund();
}

#[test]
fn invalid_refund_proof_cannot_enable_funding() {
    let f = setup(false);
    f.escrow.prepare_funding(&b(&f), &0u32, &b(&f));
    f.escrow.store_payout_proof(
        &true,
        &b(&f),
        &soroban_sdk::BytesN::from_array(&f.e, &[0; 32]),
    );
    assert_eq!(
        f.escrow.try_store_payout_proof(
            &false,
            &Bytes::from_array(&f.e, &[1]),
            &soroban_sdk::BytesN::from_array(&f.e, &[0; 32])
        ),
        Err(Ok(Error::InvalidPayoutProof))
    );
    assert_eq!(f.escrow.try_fund(), Err(Ok(Error::PayoutProofsMissing)));
}

#[test]
fn payout_proof_requires_prepared_inputs() {
    let f = setup(false);
    assert_eq!(
        f.escrow.try_store_payout_proof(
            &true,
            &b(&f),
            &soroban_sdk::BytesN::from_array(&f.e, &[0; 32])
        ),
        Err(Ok(Error::FundingNotPrepared))
    );
}

#[test]
fn unsolicited_credit_does_not_block_release() {
    let f = setup(false);
    fund(&f);
    MockTokenClient::new(&f.e, &f.token).credit(&f.escrow.address, &1);
    f.escrow.release();
    assert_eq!(last_payout_to(&f), f.recipient);
}

#[test]
fn unsolicited_credit_does_not_block_refund() {
    let f = setup(false);
    fund(&f);
    MockTokenClient::new(&f.e, &f.token).credit(&f.escrow.address, &1);
    f.e.ledger().with_mut(|li| li.timestamp = TIMEOUT + 1);
    f.escrow.timeout();
    assert_eq!(last_payout_to(&f), f.depositor);
}

#[test]
fn cannot_replace_prepared_inputs_or_proofs_after_funding() {
    let f = setup(false);
    fund(&f);
    assert_eq!(
        f.escrow.try_prepare_funding(&b(&f), &0, &b(&f)),
        Err(Ok(Error::BadState))
    );
    assert_eq!(
        f.escrow.try_store_payout_proof(
            &true,
            &b(&f),
            &soroban_sdk::BytesN::from_array(&f.e, &[0; 32])
        ),
        Err(Ok(Error::BadState))
    );
}
