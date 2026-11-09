# Finance console redesign

## Audit and constraints

The app uses Next.js, React, Tailwind and the existing Lucent SDK. Wallet-derived keys, browser proof generation, on-chain authorization, batch payroll execution and escrow contracts remain the source of truth. No contract, custody or cryptographic changes are part of this redesign.

Primary navigation: Overview, Payments, Payroll, Escrow. Supporting tools: Funding (existing /shield), Verification, Auditor, Settings (existing /profile), documentation and privacy controls. Existing URLs remain stable.

The revised visual direction uses near-black surfaces, champagne gold and a shared Manrope family for interface text and headings, with IBM Plex Mono for code and technical identifiers. Floating navigation, softly lit panels and a custom orbital brand illustration replace the earlier grey console styling. Native decimal inputs, purposeful desktop widths and visible mobile navigation labels remain. Dialogs use native modal focus management. Browser zoom and reduced motion are supported.

## Audit findings addressed

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

## Implementation delivered

| Route | Result |
| --- | --- |
| `/` | New split hero, honest interface preview, workflow explanations, Testnet entry and privacy boundaries. No invented balances, traction or testimonials. |
| `/home` | Three separate balances, merge action, unknown/setup/mismatch states, searchable and paginated available activity, explicit history coverage and retry. |
| `/send` | Registration preflight, native amount entry, contextual privacy panel, review, wallet/network feedback and confirmed transaction receipt. |
| `/shield` | Deposit/withdraw review, public-amount disclosure, precise amounts, separate balance context and merge action. |
| `/payroll` | Recipient templates and run tables, duplicate/address/registration checks, salary review, total/balance checks and atomic execution. Draft/readiness labels match contract behavior. |
| `/escrow` | Participant roles, lifecycle, deadline-gated actions, settlement review, resumable entry to funding a created agreement and explicit custody caveat. |
| `/verify` | Labeled request/bundle steps, accessible inputs and verification outcome separated from technical details. |
| `/auditor` | Masked key input, opt-in unencrypted remembering, lock control, account filtering, progressive record display and data-coverage warnings. |
| `/profile` | Account health, ordinary refresh, privacy controls and an explicit warning/confirmation before the existing full replay. |
| `/about`, `/docs`, `/stats`, `/privacy` | Updated product claims, preserved technical explanations, no embedded demo private key, limited-window event counts, unavailable-data states and existing analytics opt-outs. |

Shared components provide solid slate panels, restrained gold actions, legible typography, associated form labels, native modal focus handling, keyboard focus indicators and reduced-motion behavior. Browser zoom is enabled. Desktop has grouped navigation and flexible content grids; mobile has visible navigation labels and an accessible tools dialog.

The application-wide submission guard prevents concurrent clicks in this tab. An interruption marker in session storage survives a reload and requires an explicit outcome check before actions are re-enabled. It stores no amounts, addresses or proof inputs. A timeout is labeled uncertain, and an available transaction hash links to the explorer. These safeguards do not provide cross-tab transaction locking or automatic reconciliation.

The current wallet API exposes proof generation and a combined signing/submission/confirmation phase. The interface labels that combined phase honestly rather than inventing a finer-grained network progress signal. A receipt is shown only after the existing wallet method resolves. Existing confirmation-only analytics remain in place; uncertain actions are not reported as confirmed or definitively failed.

Freighter's selected network is checked at connection and again before signatures. Failed account refreshes invalidate the displayed account view, preventing a stale successful balance from remaining actionable. Contracts, cryptographic implementations, payment payloads, authorization rules and custody behavior were not changed.

## Reproduce the checks

Run from the repository root with the existing supported Node and pnpm environment:

```sh
pnpm install --frozen-lockfile
pnpm build:sdk
pnpm --filter @lucent/sdk typecheck
pnpm --filter @lucent/app typecheck
pnpm test:forms
pnpm test:analytics
pnpm --filter @lucent/sdk test:fast
pnpm --filter @lucent/app build
pnpm --filter @lucent/app exec playwright-core install chromium
pnpm test:ui
pnpm --filter @lucent/app test:browser
```

For contract regressions, run `cargo test` from `contracts/`. On Linux, browser installation may need `playwright-core install --with-deps chromium`. Alternatively set `CHROME_PATH` to an installed Chrome executable. On this Mac the browser suites used `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

`test:ui` builds an isolated test fixture using the real page components and mocked wallet/event boundaries. It requires the app's built CSS. Its test hooks and synthetic balances are confined to test files and are not imported by production routes. It exercises disconnected/unknown/setup states, recipient registration failures, payment review, declined approvals with retained input, double submission, confirmation, timeout/reload recovery, payroll execution, failed template creation, duplicate recipients, escrow review and network switching before signatures. It also checks five connected screens at 320, 390, 768, 1440 and 1920 pixels.

`test:browser` starts and stops its own local production server, or uses `UI_BASE_URL` when supplied. It checks all 13 public/app routes at those five widths. Both suites use axe rules tagged for WCAG A/AA through 2.2. Automated checks are not an accessibility certification or a substitute for assistive-technology user testing. CI includes the new form, browser, build and accessibility checks.

## Verification results

These results distinguish isolated UI fixtures from production pages. Mocked wallet tests are not live Testnet evidence.

- App production build: passed, including SDK build and Next.js TypeScript validation.
- App TypeScript with unused-local/parameter checks: passed. SDK typecheck: passed.
- Financial amount/error tests: passed. Seven-decimal precision uses integer base units; invalid, zero and over-balance payments are rejected.
- Existing analytics privacy/integration tests: passed.
- Existing SDK fast suite: passed; its optional live indexer comparison was skipped because no indexer endpoint was configured.
- Existing Rust/Soroban suite: 44 tests passed. No contract changes were made. Generated test snapshots were restored after validation.
- Mocked financial flows and 25 connected responsive/accessibility combinations: passed, with no detected WCAG-tagged violations.
- Production 65 route/viewport combinations: passed, with no page overflow, runtime errors or detected WCAG-tagged violations.
- Source diff whitespace checks: passed. No lint task is configured in the repository.
- No new live Testnet transactions, wallet-extension signing or cryptographic proof benchmarks were performed for this redesign. Mocked execution is not live settlement evidence.

## Visual review

Screenshots are in [screenshots/](./screenshots/). `landing-*`, `home-*`, `verify-*` and `auditor-*` show the real local production build with a disconnected wallet. Files beginning with `mock-` use the isolated wallet fixture and synthetic test balances/runs. They demonstrate design and layout only and must not be presented as user traction or Testnet payment evidence.

- [Desktop landing](./screenshots/landing-1440.png)
- [Mobile landing](./screenshots/landing-390.png)
- [Disconnected onboarding](./screenshots/home-1440.png)
- [Connected overview — mocked data](./screenshots/mock-home-1440.png)
- [Payment review — mocked data](./screenshots/mock-send-1440.png)
- [Payroll workspace — mocked data](./screenshots/mock-payroll-1440.png)

## Remaining product work

A deployed indexer and verified history coverage remain dependencies for durable statements and complete recovery. The current payroll contract scans can grow expensive as deployment-wide templates and runs increase; UI pagination does not replace indexed queries. Escrow requires a stronger custody design before real funds. Audits, browser/device recovery, cross-tab coordination, granular transaction-stage callbacks and assistive-technology testing need further work. Organizations, approvals, scheduling and persistent employee records were deliberately not fabricated. These are separate engineering milestones, not hidden completed features.

## Visual revision after feedback

The initial visual treatment was rejected. The replacement retains functional improvements while changing the composition and visual system: a large editorial hero with a pointer-responsive orbital SVG, a floating public navigation bar and desktop rail, near-black layered panels, champagne details, a product preview and darker feature sections. The previous light landing section was removed.

Motion includes slow decorative orbital rotation, pointer parallax, staggered workspace entry, button and feature hover feedback, panel lighting and dialog transitions. Decorative artwork is hidden from assistive technology and never represents transaction progress. Financial values are not animated through invented intermediate amounts. Reduced motion disables the decorative animations and parallax.

The revised build and app typecheck passed. The existing mocked financial suite plus 25 connected layout/accessibility checks passed; all 65 production route/viewport checks passed with no detected violations, overflow or runtime errors. Added browser assertions verify normal orbital animation, pointer response and the reduced-motion override. These are UI checks, not new live Testnet settlement evidence.

[New landing hero](./screenshots/landing-hero-1440.png)

## Documentation and typography expansion

The documentation now shares Lucent’s public navigation and visual shell. A canvas up to 1680px replaces the narrow article layout, with a sticky, grouped topic index, filtered topic navigation, mobile contents dialog, quick-entry cards, multi-column workflow guides, a protocol flow diagram and wider code/reference areas. Paragraph lengths remain bounded for readability; grids and reference material use the broader canvas.

Content now includes a first Testnet payment walkthrough, local setup, reproducible build/test commands, an SDK registration example, deployment guidance and a recovery/troubleshooting reference. Outdated privacy, payroll and authorization statements were corrected against the implementation. No private keys were added. The SDK example was extracted and typechecked against the actual app and SDK.

Manrope now supplies body text, headings, controls and financial amounts throughout the website, documentation and workspace. Monospace remains available for code, addresses, keys and technical data. The extra DM Sans font request was removed. The pre-existing generated development declaration was preserved rather than committed.

Validation: production build and TypeScript checks passed. The mocked financial-flow suite and 25 connected layout/accessibility checks passed. Browser checks exercise topic filtering, desktop anchor navigation, mobile contents selection and the shared body/heading family across 13 routes. The final production sweep passed all 65 route/viewport combinations, including 320px docs code containment, with no detected accessibility violations, page overflow or runtime errors. Desktop topic filtering and anchor navigation, mobile topic selection and shared body/heading font checks all passed.

- [Wide documentation preview](./screenshots/docs-1440.png)
- [Mobile documentation preview](./screenshots/docs-390.png)
