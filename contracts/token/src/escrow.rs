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
    ) -> bool {
        let registration: RegisterData = storage::decode_data(e, &register_data);
        let funding: TransferData = storage::decode_data(e, &transfer_in);
        let payout: TransferData = storage::decode_data(e, &data);
        let recipient = storage::get_account(e, &to);
        let auditor = ConfidentialAuditorClient::new(e, &storage::get_auditor(e));
        let p = &payout.payload;

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
