# Tester analytics and launch guide

Status: integration prepared on `feat/tester-analytics`; collection starts only after configuration, deployment and live verification. No historical visits are backfilled. This work does not activate an analytics account, deploy the application, or establish user traction.

Public application: **https://www.lucent-pay.xyz/**. Its public response reported Vercel hosting when checked November 9, 2026. The repository also has Cloudflare deployment tooling; do not assume that deploying that Worker updates this public Vercel site.

## What this measures

Use Umami for aggregate traffic and explicit product events. The public tracker website identifier is not an API key. No paid subscription, API credential, server database, wallet identifier or new npm dependency is needed by this integration.

| Question | Dashboard signal | Interpretation |
| --- | --- | --- |
| How much interest is there? | Visitors, visits, pageviews and known routes | Estimated browsers/sessions, not verified people |
| Where do recruited testers come from? | `source` and `campaign` event properties | Only supported, explicitly tagged invitation links |
| Can people connect? | `wallet_connect_started` → `wallet_connected` → `wallet_ready`, filter `mode=manual` | Connection and initial balance refresh are separate stages |
| Are people testing payments? | `registration_confirmed`, `deposit_confirmed`, `transfer_confirmed`, `withdrawal_confirmed` | Browser-reported chain success, not independently audited transactions |
| Is payroll being tried? | `payroll_confirmed` | A confirmed run, not employees/customers acquired |
| Is verification useful? | `disclosure_created`, `disclosure_verified` | Generated/verified disclosure, no amount or proof collected |
| Where is onboarding failing? | `action_failed` filtered by `action`, and `wallet_connect_failed` | Counts failures without raw messages or private context |

Events can be blocked, lost, repeated, forged or suppressed by privacy controls. Umami visitor identification can group people on a shared network or split one person across devices/identifier rotation. Event totals are not unique testers, unique wallets, durable returning-user counts, or customer counts. New registration events also exclude accounts registered before instrumentation.

## Account setup

1. Create an account at [Umami Cloud](https://cloud.umami.is/). The [pricing page](https://umami.is/pricing), checked November 9, 2026, lists a Hobby plan with one website, 100,000 monthly events and six-month retention. Recheck limits when signing up; a paid trial is not required for the initial integration. Pageviews/custom events/properties contribute to usage.
2. Add a website named **Lucent Testnet**, using the domain **www.lucent-pay.xyz**. Copy its Website ID and the script URL supplied in its tracking snippet. Do not paste an API key into any `NEXT_PUBLIC_` variable.
3. Put these **build-time** variables in the hosting project's Production environment:

   ```dotenv
   NEXT_PUBLIC_ANALYTICS_ENABLED=true
   NEXT_PUBLIC_ANALYTICS_HOSTNAME=www.lucent-pay.xyz
   NEXT_PUBLIC_UMAMI_WEBSITE_ID=c8ecbbeb-dea0-41e0-adc3-2a95b80a0f1e
   NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://cloud.umami.is/script.js
   ```

   Use your snippet's trusted script URL if different. The Website ID above was supplied from the Lucent Umami tracking snippet; it is public configuration. See [the environment example](packages/app/.env.example). Keep Preview and Development collection disabled. The hostname guard additionally rejects preview domains, localhost and non-HTTPS pages.
4. In the Vercel project serving the public domain, save the variables, deploy the reviewed code and trigger a **new production build**. Setting runtime variables without rebuilding does not update browser-bundled `NEXT_PUBLIC_` values. Use the existing project's deployment process; do not create a second production site just for analytics.
5. Confirm the apex domain either redirects to `www.lucent-pay.xyz` or choose one canonical hostname consistently. The current configuration accepts only the exact configured hostname. Unmatched aliases do not collect.

The Lucent Website ID was supplied on November 9, 2026 and is now recorded in the environment example and local build configuration. Hosting Production environment configuration, deployment and live dashboard verification are still required. Do not install an extra default tracking snippet: automatic tracking is intentionally disabled in this integration to prevent duplicate pageviews and URL leakage.

## Privacy and controls

The code builds a new allowlisted payload for every request. Only known route names, event names, the `testnet` label and selected enum properties can leave this module. Unknown routes become `/other`. Query strings, fragments, referrer URLs, dynamic document titles and arbitrary event properties are dropped.

**Never add** wallet addresses (including hashed addresses), balances, amounts, salaries, names/emails, transaction hashes, contract IDs, auditor secrets, proof bundles, form contents or raw exception messages to analytics. There is no `identify` call, session replay, automatic error capture, performance capture, click/form autocapture or wallet-to-visitor mapping.

A third-party tracker still runs on the page when enabled; trust the configured provider and review any future changes. Umami receives normal network request information and processes IP/User-Agent for rotating visitor identification. This integration does not promise anonymity from the provider. See its [metric definitions](https://docs.umami.is/docs/metric-definitions) and [privacy policy](https://umami.is/privacy). Hosting, RPC and blockchain services have separate data visibility.

The public `/privacy` page explains tracking and provides two per-browser controls:

- **Disable analytics** for a visitor who opts out.
- **Exclude as team/internal testing** before the owner, collaborators or automation test the public deployment.

Both stop collection, as do available DNT/GPC browser signals and Umami's `umami.disabled` flag. Storage failure disables collection. Preferences survive reloads without touching wallet state. Do not clear wallet storage to reset analytics. Tracking is also off in development, when configuration is missing/invalid, or on the wrong hostname.

The app buffers at most 32 allowlisted events while the script loads and discards them on opt-out. Delivery is best effort. Transport errors never fail or delay a financial operation. A script request already made cannot be undone by later opting out.

## Event dictionary

| Event | Trigger | Allowed contextual properties |
| --- | --- | --- |
| Pageview (no event name) | Initial page and client-side route changes | `network`, optional `source`/`campaign` |
| `wallet_connect_started` | Explicit connect or automatic reconnect starts | `mode=manual` or `auto` |
| `wallet_connected` | Wallet connection/key setup returns | `mode` |
| `wallet_ready` | Initial wallet state refresh completes | `mode` |
| `wallet_connect_failed` | Connection or initial refresh fails | `mode` |
| `action_started`, `action_failed` | Recognized payment action begins or its UI flow rejects | `action=registration/deposit/merge/transfer/withdrawal/payroll` |
| `registration_confirmed` | A new registration chain invocation succeeds | No account data |
| `deposit_confirmed`, `merge_confirmed` | Respective chain invocation succeeds | No financial data |
| `transfer_confirmed`, `withdrawal_confirmed` | Respective chain invocation succeeds | No financial data |
| `payroll_confirmed` | `execute_run` chain invocation succeeds | No run ID, employee count or salaries |
| `disclosure_created` | Holder generates a disclosure bundle | `direction=sent/received` |
| `disclosure_verified` | Verification returns successfully | No amount, event reference or verifier key |

Confirmed events are emitted after successful chain submission/polling, before local state persistence. A later local persistence failure can therefore generate both a confirmed event and an action-failure event. These measure different stages; do not subtract every failure from confirmed transactions. A timed-out client may miss a landed transaction. No success is inferred merely from a button click. Existing-account registration is not counted as a new registration.

## Tagged invitations

Only these sources are accepted: `stellar`, `scf`, `twitter`, `telegram`, `discord`, `github`, `newsletter`, `community`. Campaigns: `testnet-pilot`, `scf46`. All other values are discarded, including arbitrary referral identifiers. Add a new enum deliberately if needed.

Example invitation:

```text
https://www.lucent-pay.xyz/?utm_source=stellar&utm_campaign=testnet-pilot
```

Use these as aggregate campaign tags, not per-person links. The tags are recorded only on events whose current URL has those parameters; there is no cross-page campaign persistence. Analyze tagged landing visits separately from later aggregate actions. The properties are custom `source` and `campaign` fields, not automatically populated native UTM reports. Full referrers are deliberately omitted.

## Production smoke check before recruitment

1. Set your normal browser to internal exclusion via `/privacy`. Use a **separate non-excluded browser/profile** for a one-time smoke check and record its date so you can exclude that QA window from reporting. Privacy controls or ad blockers may legitimately prevent collection.
2. Open the tagged invitation. In browser Network tools, check that the configured script loads and the collector accepts a **single** pageview. Inspect the outgoing JSON: only allowlisted route/name/properties, no URL query, referrer or sensitive fields. Confirm it appears in Umami.
3. Navigate `/` → `/home` → `/shield` without reloads. Confirm exactly one pageview per navigation. Reload once and verify one additional view. Duplicate snippets must be removed.
4. With disposable Testnet accounts, connect, register if new, obtain the correct test USDC/trustline, deposit, merge, send and withdraw a tiny amount. Verify the relevant events appear **after** on-chain success. Cancel one wallet request and check the failure stage without a confirmed event. No need to exercise unsafe escrow for the initial pilot.
5. Toggle opt-out on `/privacy`, navigate and attempt an action. No subsequent collector events should be sent; the app must still work. Check DNT/GPC and internal exclusion similarly. A preview deployment should never collect into the production property.
6. Repeat one flow from another device/browser with Freighter support. Document failures rather than treating a successful build as browser acceptance. Confirm the deployed `/privacy` notice and control links are available.

The public site already responds successfully and exposes the proving isolation headers. That is a read-only deployment observation, not a fresh payment acceptance test. Analytics cannot start before the real Website ID is configured and this smoke check passes.

## Recruitment plan and SCF evidence

Start with **5–10 invited Testnet testers after the smoke check**, then expand after fixing the first onboarding failures. This is a proposed cohort size, not existing traction. Ask testers to use disposable accounts and no real funds. Explain the public demo auditor and recovery limitations. Start with confidential payments/disclosure; escrow remains a demonstration with its known custody caveat. Preserve local wallet state; reliable full-history recovery is not supplied by analytics.

For each reporting week, save a dated dashboard export/screenshot with timezone and date range, release commit, campaign label and team/QA exclusions. Confirm export/report features available on your plan before relying on them; take sanitized screenshots if necessary. Keep evidence outside provider retention windows. Do not make a shared dashboard public without checking the displayed properties.

A useful weekly table:

| Period (UTC) | Estimated visitors | Manual wallet-ready visitors | Transfer event count / distinct visitors | Payroll event count | Feedback participants | Caveats |
| --- | --- | --- | --- | --- | --- | --- |
| Fill from observed data | — | — | — | — | — | QA exclusions, blockers, Testnet only |

Where a funnel report is available, use the same date range, visitor unit, filters and order. Otherwise show the counts separately; unrelated daily totals do not establish an ordered conversion funnel. Do not claim retention across identifier rotation or equate connections/reconnects with new people. Keep developer testing and collaborator traffic out of external traction counts.

Suggested application wording, **only after real data exists**: “During [period], Lucent's Testnet site recorded [N] estimated visitors and [M] visitors with a browser-reported confirmed transfer, excluding [documented internal/QA activity]. [K] people separately provided tester feedback.” Distinguish observations from goals and describe the measurement limits.

Pair aggregate charts with reproducible Testnet transaction evidence from consenting pilot participants, issue-resolution notes and anonymized usability findings. Record consented feedback separately from telemetry and do not silently join browser identities to public wallet addresses. Public transaction evidence is not proof of unique people, paid customers, revenue, Mainnet use or security review.

## Developer checks

```bash
pnpm build:sdk
pnpm test:analytics
pnpm --filter @lucent/app typecheck
pnpm --filter @lucent/app build
```

The automated analytics test uses a fake tracker and mocked chain; it sends no live telemetry or transactions. It covers payload sanitization, environment/hostname gates, DNT/GPC, opt-out/internal exclusion, route deduplication, bounded queue, failure isolation, and rejected-versus-confirmed submission handling. No tests authenticate to the analytics dashboard. Production collection remains unverified until the smoke check above.

Implementation references: `packages/app/lib/analytics.ts`, `components/analytics/Analytics.tsx`, `lib/wallet.ts`, `lib/wallet-context.tsx`, and `/privacy`. Official setup references: [tracker configuration](https://docs.umami.is/docs/tracker-configuration), [custom payloads](https://docs.umami.is/docs/tracker-functions), [installation](https://docs.umami.is/docs/collect-data).

## Local verification record — November 9, 2026

- Analytics privacy/confirmation tests passed with an in-memory fake tracker and rejected/pending/successful submission promises.
- App TypeScript check and production build passed with a dummy public Website ID.
- An isolated headless Chrome test of that production build passed initial and client-side pageviews, sensitive query exclusion, opt-out/re-enable, team exclusion across reload, DNT/GPC and preview-domain exclusion. The test routed the site to a local server and replaced the analytics script with a fake collector; RPC and other external services were blocked. No real analytics or payment transactions were sent.
- No live Umami dashboard or production payment smoke test was performed. The production activation checklist above remains required.
