//! Read-only preflight for an escrow's future outgoing transfer. This does not
//! authorize a transfer, register an account, or move funds. The escrow must
//! later execute exactly the register_data / transfer_in it validated here.
//! PI order and canonical checks mirror stellar-tokens 539968f storage.rs.

use soroban_sdk::{contractimpl, panic_with_error, Address, Bytes, BytesN, Env};
use stellar_contract_utils::crypto::grumpkin::{Grumpkin, Point};
use stellar_tokens::confidential::{
    auditor::ConfidentialAuditorClient,
    storage::{self, RegisterData, TransferData},
    verifier::{CircuitType, ConfidentialVerifierClient},
    ConfidentialTokenError,
};

use crate::{
    ConfidentialTokenContract, ConfidentialTokenContractArgs, ConfidentialTokenContractClient,
};

#[contractimpl]
impl ConfidentialTokenContract {
    /// Validate a payout against the account and spendable commitment that
    /// atomic register -> transfer-in -> merge will produce. Account keys and
    /// auditor keys for the recipient are read from this token, never supplied
    /// by the depositor. The funding call independently verifies registration
    /// and transfer-in before committing either of them.
    pub fn verify_escrow_payout(
        e: &Env,
        register_data: Bytes,
        auditor_id: u32,
        transfer_in: Bytes,
        to: Address,
        data: Bytes,
        remaining_blinding: soroban_sdk::BytesN<32>,
    ) -> bool {
        let registration: RegisterData = storage::decode_data(e, &register_data);
        let funding: TransferData = storage::decode_data(e, &transfer_in);
        let payout: TransferData = storage::decode_data(e, &data);
        let recipient = storage::get_account(e, &to);
        let auditor = ConfidentialAuditorClient::new(e, &storage::get_auditor(e));
        let p = &payout.payload;

        // A general transfer proof permits a partial payout. Bind its remaining
        // commitment to a publicly opened zero balance before accepting it.
        if !Grumpkin::is_canonical_field(&remaining_blinding)
            || p.c_spend_new != zero_commitment(e, &remaining_blinding)
        {
            return false;
        }
        let mut pi = Bytes::new(e);
        append_point(&mut pi, &funding.payload.c_tx);
        append_point(&mut pi, &registration.payload.y);
        append_point(&mut pi, &recipient.viewing_public_key);
        append_field(&mut pi, &storage::get_address_as_field_element(e));
        append_point(&mut pi, &auditor.get_key(&recipient.auditor_id));
        append_point(&mut pi, &auditor.get_key(&auditor_id));
        append_point(&mut pi, &p.c_spend_new);
        append_point(&mut pi, &p.c_tx);
        append_point(&mut pi, &p.r_e);
        for field in [
            &p.v_tilde, &p.b_tilde, &p.sigma, &p.v_aud_r, &p.r_aud_r, &p.v_aud_s, &p.b_aud_s,
        ] {
            append_field(&mut pi, field);
        }
        ConfidentialVerifierClient::new(e, &storage::get_verifier(e)).verify_proof(
            &CircuitType::Transfer,
            &pi,
            &payout.proof,
        )
    }
}

fn append_point(pi: &mut Bytes, point: &Point) {
    if !Grumpkin::is_canonical_point(point) {
        panic_with_error!(pi.env(), ConfidentialTokenError::NonCanonicalEncoding);
    }
    pi.append(&Bytes::from(point));
}

fn append_field(pi: &mut Bytes, field: &BytesN<32>) {
    if !Grumpkin::is_canonical_field(field) {
        panic_with_error!(pi.env(), ConfidentialTokenError::NonCanonicalEncoding);
    }
    pi.append(&Bytes::from(field));
}

/// Compute r·H with the same independent blinding generator as the circuits.
fn zero_commitment(e: &Env, r: &BytesN<32>) -> Point {
    let h = BytesN::from_array(
        e,
        &[
            5, 74, 168, 106, 115, 203, 138, 52, 82, 94, 91, 190, 214, 228, 59, 161, 25, 142, 134,
            15, 95, 57, 80, 38, 143, 113, 223, 69, 145, 189, 228, 2, 32, 157, 207, 191, 44, 251,
            87, 249, 246, 4, 111, 68, 215, 26, 198, 250, 248, 114, 84, 175, 199, 64, 124, 4, 235,
            98, 26, 98, 135, 202, 193, 38,
        ],
    );
    let mut result = Grumpkin::identity(e);
    for byte in r.to_array() {
        for bit in (0..8).rev() {
            result = Grumpkin::add(e, &result, &result);
            if byte & (1 << bit) != 0 {
                result = Grumpkin::add(e, &result, &h);
            }
        }
    }
    result
}

#[cfg(test)]
mod zero_tests {
    use super::*;

    #[test]
    fn zero_opening_uses_the_circuit_blinding_generator() {
        let e = Env::default();
        let mut one = [0u8; 32];
        one[31] = 1;
        let h = zero_commitment(&e, &BytesN::from_array(&e, &one));
        assert!(Grumpkin::is_on_curve(&e, &h));
        assert_ne!(h, Grumpkin::generator(&e));
        let mut two = one;
        two[31] = 2;
        assert_eq!(
            zero_commitment(&e, &BytesN::from_array(&e, &two)),
            Grumpkin::add(&e, &h, &h)
        );
        let large = [0x10u8; 32];
        assert!(Grumpkin::is_on_curve(
            &e,
            &zero_commitment(&e, &BytesN::from_array(&e, &large))
        ));
    }
}
