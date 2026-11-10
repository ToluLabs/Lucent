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
      const startup = await page.evaluate(() => ({
        externalFonts: performance
          .getEntriesByType("resource")
          .filter((r) =>
            /fonts\.(googleapis|gstatic)\.com/.test(new URL(r.name).hostname),
          ).length,
        jsBytes: performance
          .getEntriesByType("resource")
          .filter(
            (r) =>
              r.name.includes("/_next/") &&
              new URL(r.name).pathname.endsWith(".js"),
          )
          .reduce((n, r) => n + r.decodedBodySize, 0),
        fontReady: document.fonts.check("500 16px Manrope", "Lucent"),
      }));
      assert.equal(
        startup.externalFonts,
        0,
        `${route} must not depend on remote font requests`,
      );
      assert.ok(startup.fontReady, `${route} local UI font loads`);
      if (["/", "/docs"].includes(route))
        assert.ok(
          startup.jsBytes < 900 * 1024,
          `${route} public-page JS budget exceeded: ${Math.round(startup.jsBytes / 1024)} KB`,
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
      const families = await page.evaluate(() => ({
        body: getComputedStyle(document.body).fontFamily,
        heading: getComputedStyle(document.querySelector("h1")).fontFamily,
      }));
      assert.equal(
        families.body.split(",")[0].replaceAll('"', ""),
        "Manrope",
        `${route} body uses the shared UI font`,
      );
      assert.equal(
        families.heading.split(",")[0].replaceAll('"', ""),
        "Manrope",
        `${route} heading uses the shared UI font`,
      );
      if (route === "/docs") {
        if ([390, 1440].includes(width))
          await page.screenshot({ path: resolve(output, `docs-${width}.png`) });
        if (width === 1440) {
          const search = page.getByLabel("Find a documentation topic");
          await search.fill("SDK");
          const link = page
            .getByRole("navigation", {
              name: "Documentation topics",
              exact: true,
            })
            .getByRole("link", { name: "SDK integration", exact: true });
          await link.click();
          assert.equal(await page.evaluate(() => location.hash), "#sdk");
          await search.fill("");
        }
        if (width === 390) {
          await page
            .getByRole("button", { name: "Topics", exact: true })
            .click();
          const dialog = page.getByRole("dialog", {
            name: "Documentation topics",
            exact: true,
          });
          await dialog.getByLabel("Find a documentation topic").fill("payroll");
          await dialog
            .getByRole("link", { name: "Payroll", exact: true })
            .click();
          assert.equal(await page.getByRole("dialog").count(), 0);
          assert.equal(await page.evaluate(() => location.hash), "#payroll");
        }
      }

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
