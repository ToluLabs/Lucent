extern crate std;

use crate::{ConfidentialTokenContract, ConfidentialTokenContractClient};
use soroban_sdk::{
    contract, contractimpl, symbol_short, testutils::Address as _, xdr::ToXdr, Address, Bytes,
    BytesN, Env,
};
use stellar_contract_utils::crypto::grumpkin::{Grumpkin, Point};
use stellar_tokens::confidential::{
    storage::{
        self, ConfidentialTokenStorageKey, RegisterData, RegisterPayload, TransferData,
        TransferPayload,
    },
    verifier::CircuitType,
    ConfidentialAccount,
};

#[contract]
struct Verifier;
#[contractimpl]
impl Verifier {
    pub fn verify_proof(
        e: &Env,
        circuit_type: CircuitType,
        public_inputs: Bytes,
        proof: Bytes,
    ) -> bool {
        assert_eq!(circuit_type, CircuitType::Transfer);
        e.storage()
            .instance()
            .set(&symbol_short!("pi"), &public_inputs);
        proof == Bytes::from_array(e, &[42])
    }
    pub fn inputs(e: &Env) -> Bytes {
        e.storage().instance().get(&symbol_short!("pi")).unwrap()
    }
}

#[contract]
struct Auditor;
#[contractimpl]
impl Auditor {
    pub fn get_key(e: &Env, auditor_id: u32) -> Point {
        Grumpkin::mul(e, &Grumpkin::generator(e), u128::from(auditor_id) + 1)
    }
}

fn point(e: &Env, n: u128) -> Point {
    Grumpkin::mul(e, &Grumpkin::generator(e), n)
}
fn field(e: &Env, n: u8) -> BytesN<32> {
    let mut bytes = [0; 32];
    bytes[31] = n;
    BytesN::from_array(e, &bytes)
}
fn transfer(e: &Env) -> TransferData {
    TransferData {
        proof: Bytes::from_array(e, &[42]),
        payload: TransferPayload {
            c_spend_new: point(e, 4),
            c_tx: point(e, 5),
            r_e: point(e, 6),
            v_tilde: field(e, 7),
            b_tilde: field(e, 8),
            sigma: field(e, 9),
            v_aud_r: field(e, 10),
            r_aud_r: field(e, 11),
            v_aud_s: field(e, 12),
            b_aud_s: field(e, 13),
        },
    }
}

struct Fixture {
    e: Env,
    token: Address,
    verifier: Address,
    from: Address,
    to: Address,
    registration: RegisterData,
    funding: TransferData,
    payout: TransferData,
}
fn setup() -> Fixture {
    let e = Env::default();
    e.mock_all_auths();
    let verifier = e.register(Verifier, ());
    let auditor = e.register(Auditor, ());
    let token = e.register(
        ConfidentialTokenContract,
        (
            Address::generate(&e),
            verifier.clone(),
            auditor,
            Address::generate(&e),
        ),
    );
    let from = Address::generate(&e);
    let to = Address::generate(&e);
    let registration = RegisterData {
        payload: RegisterPayload {
            y: point(&e, 2),
            pvk: point(&e, 3),
        },
        proof: Bytes::new(&e),
    };
    let funding = transfer(&e);
    let mut payout = transfer(&e);
    payout.payload.c_spend_new = Grumpkin::identity(&e);
    e.as_contract(&token, || {
        e.storage().persistent().set(
            &ConfidentialTokenStorageKey::Account(from.clone()),
            &ConfidentialAccount {
                spending_key: registration.payload.y.clone(),
                viewing_public_key: registration.payload.pvk.clone(),
                spendable_balance: funding.payload.c_tx.clone(),
                receiving_balance: Grumpkin::identity(&e),
                auditor_id: 1,
            },
        );
        e.storage().persistent().set(
            &ConfidentialTokenStorageKey::Account(to.clone()),
            &ConfidentialAccount {
                spending_key: point(&e, 14),
                viewing_public_key: point(&e, 15),
                spendable_balance: Grumpkin::identity(&e),
                receiving_balance: Grumpkin::identity(&e),
                auditor_id: 2,
            },
        );
    });
    Fixture {
        e,
        token,
        verifier,
        from,
        to,
        registration,
        funding,
        payout,
    }
}

#[test]
fn escrow_preflight_matches_real_token_transfer_public_inputs_without_moving_funds() {
    let f = setup();
    let client = ConfidentialTokenContractClient::new(&f.e, &f.token);
    let before =
        f.e.as_contract(&f.token, || storage::get_account(&f.e, &f.from));
    assert!(client.verify_escrow_payout(
        &f.registration.to_xdr(&f.e),
        &1,
        &f.funding.to_xdr(&f.e),
        &f.to,
        &f.payout.clone().to_xdr(&f.e),
        &BytesN::from_array(&f.e, &[0; 32])
    ));
    let expected = VerifierClient::new(&f.e, &f.verifier).inputs();
    assert_eq!(
        before,
        f.e.as_contract(&f.token, || storage::get_account(&f.e, &f.from))
    );
    // Exercise the actual pinned upstream transfer code, not another PI builder.
    client.confidential_transfer(&f.from, &f.to, &f.payout.to_xdr(&f.e));
    assert_eq!(expected, VerifierClient::new(&f.e, &f.verifier).inputs());
}

#[test]
fn escrow_preflight_propagates_verifier_rejection() {
    let mut f = setup();
    f.payout.proof = Bytes::from_array(&f.e, &[0]);
    assert!(
        !ConfidentialTokenContractClient::new(&f.e, &f.token).verify_escrow_payout(
            &f.registration.to_xdr(&f.e),
            &1,
            &f.funding.to_xdr(&f.e),
            &f.to,
            &f.payout.to_xdr(&f.e),
            &BytesN::from_array(&f.e, &[0; 32])
        )
    );
}

#[test]
fn escrow_preflight_rejects_malformed_payload() {
    let f = setup();
    assert!(ConfidentialTokenContractClient::new(&f.e, &f.token)
        .try_verify_escrow_payout(
            &f.registration.to_xdr(&f.e),
            &1,
            &f.funding.to_xdr(&f.e),
            &f.to,
            &Bytes::new(&f.e),
            &BytesN::from_array(&f.e, &[0; 32])
        )
        .is_err());
}

#[test]
fn escrow_preflight_rejects_noncanonical_public_inputs() {
    let mut f = setup();
    f.payout.payload.sigma = BytesN::from_array(&f.e, &[255; 32]);
    assert!(ConfidentialTokenContractClient::new(&f.e, &f.token)
        .try_verify_escrow_payout(
            &f.registration.to_xdr(&f.e),
            &1,
            &f.funding.to_xdr(&f.e),
            &f.to,
            &f.payout.to_xdr(&f.e),
            &BytesN::from_array(&f.e, &[0; 32])
        )
        .is_err());
}

#[test]
fn escrow_preflight_rejects_partial_payout_even_when_transfer_verifier_accepts() {
    let mut f = setup();
    f.payout.payload.c_spend_new = point(&f.e, 4);
    assert!(
        !ConfidentialTokenContractClient::new(&f.e, &f.token).verify_escrow_payout(
            &f.registration.to_xdr(&f.e),
            &1,
            &f.funding.to_xdr(&f.e),
            &f.to,
            &f.payout.to_xdr(&f.e),
            &BytesN::from_array(&f.e, &[0; 32]),
        )
    );
}
