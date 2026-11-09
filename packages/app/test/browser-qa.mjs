/** Real production pages, disconnected wallet. Run against a local production build. */
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "playwright-core";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const axe = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
let base = process.env.UI_BASE_URL;
let appServer;
if (!base) {
  const socket = createServer();
  await new Promise((r) => socket.listen(0, "127.0.0.1", r));
  const port = socket.address().port;
  await new Promise((r) => socket.close(r));
  base = `http://127.0.0.1:${port}`;
  appServer = spawn(
    process.execPath,
    [
      require.resolve("next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: resolve(import.meta.dirname, ".."), stdio: "ignore" },
  );
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!ready) {
    appServer.kill();
    throw new Error(
      "Local production app failed to start. Run the app build first.",
    );
  }
}
const output = resolve(
  process.env.UI_SCREENSHOTS ?? "../../docs/design/screenshots",
);
await mkdir(output, { recursive: true });
let browser;
const report = [];
const runtimeErrors = [];
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });

  for (const width of [320, 390, 768, 1440, 1920]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(() =>
      localStorage.setItem("lucent:analytics:internal", "1"),
    );
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror", (e) => runtimeErrors.push(e.message));
    for (const route of [
      "/",
      "/home",
      "/send",
      "/shield",
      "/payroll",
      "/escrow",
      "/verify",
      "/auditor",
      "/profile",
      "/about",
      "/docs",
      "/stats",
      "/privacy",
    ]) {
      console.log(`Checking ${width} ${route}`);
      await page.goto(base + route, { waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { level: 1 }).waitFor();
      await page.evaluate(() =>
        Promise.race([
          document.fonts.ready,
          new Promise((r) => setTimeout(r, 1000)),
        ]),
      );
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      await page.addScriptTag({ content: axe });
      const violations = await page.evaluate(async () => {
        const r = await window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
          },
        });
        return r.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        }));
      });
      report.push({ width, route, overflow, violations });
      if (
        (width === 390 || width === 1440) &&
        ["/", "/home", "/verify", "/auditor"].includes(route)
      )
        await page.screenshot({
          path: resolve(
            output,
            `${route === "/" ? "landing" : route.slice(1)}-${width}.png`,
          ),
          fullPage: true,
        });
    }
    if (width === 390) {
      await page.goto(base + "/home");
      await page.getByRole("button", { name: "More", exact: true }).click();
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      assert.equal(await page.getByRole("dialog").count(), 0);
      await page.getByRole("button", { name: "More", exact: true }).focus();
      assert.equal(
        await page.evaluate(() => document.activeElement?.textContent),
        "More",
      );
    }
    await context.close();
  }
  await writeFile(
    resolve(output, "browser-qa.json"),
    JSON.stringify({ report, runtimeErrors }, null, 2),
  );
  const issues = report.filter((r) => r.overflow || r.violations.length);
  console.log(
    JSON.stringify(
      {
        viewports: 5,
        routes: 13,
        checks: report.length,
        issues,
        runtimeErrors,
      },
      null,
      2,
    ),
  );
  assert.equal(issues.length, 0, "Responsive or accessibility violations");
  assert.deepEqual(runtimeErrors, []);
} finally {
  await browser?.close();
  appServer?.kill();
}
