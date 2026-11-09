# Finance console redesign

## Audit and constraints

The app uses Next.js, React, Tailwind and the existing Lucent SDK. Wallet-derived keys, browser proof generation, on-chain authorization, batch payroll execution and escrow contracts remain the source of truth. No contract, custody or cryptographic changes are part of this redesign.

Primary navigation: Overview, Payments, Payroll, Escrow. Supporting tools: Funding (existing /shield), Verification, Auditor, Settings (existing /profile), documentation and privacy controls. Existing URLs remain stable.

Solid dark surfaces and restrained gold preserve Lucent's identity without grain, glows or glass. Native decimal inputs replace the custom keypad. Desktop content uses the available width; mobile navigation retains visible labels. Dialogs use native modal focus management. Browser zoom and reduced motion are supported.

## Findings to address

- Spendable and receiving balances must remain separate. Incoming funds require merging.
- Recent RPC events are not all-time history. Failed history requests must not become empty activity or zero statistics.
- Payroll's Scheduled contract enum is a draft, not calendar scheduling. Confirming a run moves no money; executing it pays the atomic batch. Receiving funds alone do not prove salary provenance.
- Failed operations must preserve input. Confirmation timeouts mean uncertain settlement, not failure. Prevent concurrent submissions and require reconciliation before retrying an uncertain transaction.
- Recipient registration checks must distinguish unregistered from unavailable.
- Public deposits, withdrawals, addresses and metadata remain observable. Demo auditor keys are public, so their access is not exclusive.
- Escrow is experimental: the depositor retains the instance key and can invalidate prepared payouts. Do not imply trustless custody.
- Browser state and retained openings matter. Clearing storage or replaying incomplete history is not guaranteed recovery.

## Dependencies and deliberately deferred capabilities

Complete durable history requires a deployed, monitored indexer and recovery design; configuration alone does not establish complete coverage. Organizations, employee directories, scheduling, approvals and Mainnet readiness require additional backend/security work. Individual partial payroll settlement is not supported by the atomic contract. Fees are determined by simulation/wallet approval, not estimated by invented UI values. This work introduces no audit, traction or live Testnet evidence.

## Verification

Record actual commands, browser checks and results below as implementation progresses. Mocked wallet tests are not live Testnet evidence.
