/** Diagnostic startup sample, not a field-performance or Lighthouse score.
 * Build the app first. Uses a disposable production server and browser contexts.
 * Optional PERF_DEV_URL adds an existing development server. No wallet signing.
 */
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import fs from "node:fs";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";
const app = resolve(import.meta.dirname, "..");
const req = createRequire(resolve(app, "package.json"));
const { chromium } = req("playwright-core");
(async () => {
  const socket = createServer();
  await new Promise((r) => socket.listen(0, "127.0.0.1", r));
  const port = socket.address().port;
  await new Promise((r) => socket.close(r));
  const local = `http://127.0.0.1:${port}`;
  const server = spawn(
    process.execPath,
    [
      req.resolve("next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: app, stdio: "ignore" },
  );
  let browser;
  const report = [];
  try {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(local)).ok) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROME_PATH
        ? { executablePath: process.env.CHROME_PATH }
        : {}),
    });
    for (const target of [
      { label: "local-production", base: local },
      ...(process.env.PERF_DEV_URL
        ? [{ label: "local-development", base: process.env.PERF_DEV_URL }]
        : []),
    ]) {
      for (const route of ["/", "/docs", "/home"]) {
        const context = await browser.newContext({
          viewport: { width: 1440, height: 1000 },
          reducedMotion: "no-preference",
        });
        await context.addInitScript(() => {
          localStorage.setItem("lucent:analytics:internal", "1");
          localStorage.setItem("lucent:wallet:manually-disconnected", "1");
          window.__perf = { tasks: [], lcp: null };
          new PerformanceObserver((l) =>
            window.__perf.tasks.push(...l.getEntries().map((x) => x.duration)),
          ).observe({ type: "longtask", buffered: true });
          new PerformanceObserver((l) => {
            window.__perf.lcp = l.getEntries().at(-1)?.startTime;
          }).observe({ type: "largest-contentful-paint", buffered: true });
        });
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
        try {
          await page.goto(target.base + route, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
          await page.waitForTimeout(2500);
          const value = await page.evaluate(async () => {
            const nav = performance.getEntriesByType("navigation")[0];
            const resources = performance.getEntriesByType("resource");
            const scripts = resources.filter(
              (r) =>
                r.name.includes("/_next/") &&
                new URL(r.name).pathname.endsWith(".js"),
            );
            const frames = await new Promise((resolve) => {
              const times = [];
              let start, last;
              const frame = (t) => {
                start ??= t;
                if (last) times.push(t - last);
                last = t;
                if (t - start < 1200) requestAnimationFrame(frame);
                else
                  resolve({
                    samples: times.length,
                    gapsOver50: times.filter((x) => x > 50).length,
                    maxGap: Math.round(Math.max(...times)),
                  });
              };
              requestAnimationFrame(frame);
            });
            return {
              heading: document.querySelector("h1")?.textContent,
              ttfb: Math.round(nav.responseStart - nav.requestStart),
              domReady: Math.round(nav.domContentLoadedEventEnd),
              lcp: Math.round(window.__perf.lcp ?? 0),
              jsDecodedKB: Math.round(
                scripts.reduce((n, r) => n + r.decodedBodySize, 0) / 1024,
              ),
              jsEncodedKB: Math.round(
                scripts.reduce((n, r) => n + r.encodedBodySize, 0) / 1024,
              ),
              jsRequests: scripts.length,
              longTasks: window.__perf.tasks.length,
              blockingMs: Math.round(
                window.__perf.tasks.reduce(
                  (n, t) => n + Math.max(0, t - 50),
                  0,
                ),
              ),
              fonts: resources
                .filter((r) => r.name.includes("fonts."))
                .map((r) => ({
                  host: new URL(r.name).hostname,
                  duration: Math.round(r.duration),
                })),
              frames,
            };
          });
          const fontResponse = await page.request.get(
            target.base + "/fonts/manrope-v23-latin.woff2",
          );
          const row = {
            target: target.label,
            route,
            ...value,
            localFontStatus: fontResponse.status(),
            localFontCache: fontResponse.headers()["cache-control"],
          };
          report.push(row);
          console.log(JSON.stringify(row));
        } catch (e) {
          report.push({ target: target.label, route, error: e.message });
          console.log(target.label, route, e.message);
        }
        await context.close();
      }
    }
    fs.writeFileSync(
      process.env.PERF_REPORT ?? join(tmpdir(), "lucent-performance.json"),
      JSON.stringify(
        {
          settings: {
            cpuSlowdown: 4,
            networkThrottling: false,
            viewport: { width: 1440, height: 1000 },
            cache: "disabled",
            wallet: "disconnected",
            analytics: "excluded",
            samplesPerRoute: 1,
          },
          routes: report,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser?.close();
    server.kill();
  }
})();
