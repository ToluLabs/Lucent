# Startup performance investigation

Measured on 9 November 2026 after reports of localhost lag. This is a local diagnostic sample, not field performance, a Lighthouse score or live Testnet evidence.

## Findings

1. The root wallet provider imported the wallet engine, circuit artifacts and cryptographic dependencies eagerly, even on public pages.
2. Public navigation prefetched wallet screens. A resource trace showed a 974,447-byte decoded Stellar SDK chunk starting in the background during landing-page startup.
3. Google Fonts CSS was loaded through a render-blocking CSS import. One observed request took 5,455 ms. This was network-dependent and remained a bottleneck after JavaScript was reduced.
4. Development mode served substantially more unminified/debug JavaScript, and route compilation added server wait time. This overhead is separate from the production build.

## Changes

- Load the existing wallet engine dynamically on connection. Check prior Varial access only on wallet routes. Explicit disconnection, manual retry and the existing signing/refresh logic remain intact.
- Defer dashboard history dependencies until a connected wallet needs them.
- Disable background wallet-route prefetch on public pages, and prefetch workspace navigation only when a wallet is connected. The first visit to a wallet screen may fetch its code on demand; connected navigation can still prefetch it.
- Serve the same Manrope and IBM Plex Mono families from versioned local WOFF2 assets. Preload the main Latin UI font, preserve all upstream Unicode subsets and include the original license notices/provenance under `packages/app/public/fonts/`. Only needed subsets are requested.
- Cache versioned font assets as immutable. No external Google Fonts stylesheet or font request remains.

No contract, cryptographic algorithm, transaction payload or proof constraint was changed. Proof generation and RPC synchronization can still take time and were not benchmarked with a live wallet here.

## Observed production-preview startup

Cold browser contexts, a disposable local production server, Chrome headless, 1440 × 1000 viewport, 4× CPU slowdown, no network throttling, wallet disconnected and analytics excluded. One sample per route. Startup JS includes scripts requested during the observation window, including background prefetch. Decoded sizes are not network-transfer sizes.

| Route | Decoded JS before → after | Encoded JS before → after | Observed blocking before → after |
| --- | --- | --- | --- |
| Landing | 2,134 → 507 KiB | 606 → 155 KiB | 574 → 105 ms |
| Documentation | 2,134 → 507 KiB | 606 → 155 KiB | 575 → 196 ms |
| Disconnected overview | 2,249 → 683 KiB | 648 → 213 KiB | 599 → 82 ms |

Landing startup decoded JS fell about 76%; encoded JS fell about 74%. Blocking is the sum of portions of observed long tasks beyond 50 ms during this sample, not Lighthouse Total Blocking Time. Timing varies by hardware, cache, network and background load. Local loopback timings do not predict public-network page speed.

In the development samples, landing decoded JS fell from 17,612 to 12,743 KiB and disconnected overview from 25,030 to 15,294 KiB. Development responses include debug code and source-map overhead; compilation and hot reload make timing comparisons noisy. Development remained slower than the production preview. The final samples made no external font requests; the local font returned HTTP 200 with immutable caching.

Raw observations: [before](./performance-before.json), [after](./performance-after.json).

## Reproduce

Build first:

```sh
pnpm --filter @lucent/app build
pnpm --filter @lucent/app exec playwright-core install chromium
pnpm --filter @lucent/app profile:startup
```

The profiler starts and stops its own production server and creates isolated browser contexts. It never signs transactions. Set `CHROME_PATH` to an installed Chrome executable if desired. `PERF_REPORT` changes the JSON output path; the default is the system temporary directory. Set `PERF_DEV_URL=http://localhost:3000` to also sample an already-running development server. Avoid concurrent builds and browser tests when comparing results.

To experience production speed without stopping the development server, after building run:

```sh
pnpm --filter @lucent/app start --port 3001
```

Open `http://localhost:3001`. Rebuild after code changes; this preview does not hot reload.

## Regression checks

- The real provider is exercised with isolated wallet boundaries: public pages do not initialize it; wallet routes reconnect once; explicit disconnect, connection failure and retry are preserved.
- Existing mocked payment, payroll, escrow and motion tests pass.
- All 65 production route/viewport checks pass, alongside 25 connected layout/accessibility checks. Public landing/docs startup JS is capped below 900 KiB decoded in the browser check. External font requests are forbidden and the local UI font must load.
- Production build and strict app typechecks pass. Tests do not establish live Testnet settlement performance.
