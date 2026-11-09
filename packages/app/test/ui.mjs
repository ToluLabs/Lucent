/** Mocked UI integration tests. No wallet extension, signing or Testnet transaction. */
import { build } from "esbuild";
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { mkdtemp, readFile, readdir, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
const dir = await mkdtemp(join(tmpdir(), "lucent-ui-"));
const app = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const axe = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const output = resolve(
  process.env.UI_SCREENSHOTS ?? resolve(app, "../../docs/design/screenshots"),
);
await mkdir(output, { recursive: true });
const cssNames = await readdir(resolve(app, ".next/static/css"));
const css = (
  await Promise.all(
    cssNames
      .filter((n) => n.endsWith(".css"))
      .map((n) => readFile(resolve(app, ".next/static/css", n), "utf8")),
  )
).join("\n");
const react = resolve(app, "node_modules/react/index.js");
let browser, server;
try {
  await build({
    entryPoints: [resolve(app, "test/fixtures/entry.tsx")],
    outfile: join(dir, "fixture.js"),
    bundle: true,
    platform: "browser",
    format: "esm",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"test"', "process.env": "{}" },
    external: ["@aztec/bb.js"],
    plugins: [
      {
        name: "fixture-boundaries",
        setup(b) {
          b.onResolve({ filter: /wallet-context$/ }, () => ({
            path: resolve(app, "test/fixtures/wallet.tsx"),
          }));
          b.onResolve({ filter: /^next\/(link|navigation)$/ }, (args) => ({
            path: args.path,
            namespace: "next-mock",
          }));
          b.onLoad({ filter: /.*/, namespace: "next-mock" }, (args) => ({
            contents:
              args.path === "next/link"
                ? `import React from ${JSON.stringify(react)};export default function Link({prefetch,...p}){return React.createElement('a',p);}`
                : `export const usePathname=()=>location.pathname;export const useRouter=()=>({push:p=>location.href=p,back:()=>history.back()});`,
            loader: "js",
            resolveDir: app,
          }));
          b.onResolve({ filter: /^@stellar\/freighter-api$/ }, () => ({
            path: "freighter",
            namespace: "freighter-mock",
          }));
          b.onLoad({ filter: /.*/, namespace: "freighter-mock" }, () => ({
            contents: `export const isConnected=async()=>({isConnected:true});export const isAllowed=async()=>({isAllowed:true});export const requestAccess=async()=>({address:"fixture"});export const getNetworkDetails=async()=>({networkPassphrase:window.__wrongNetwork?"Public Global Stellar Network ; September 2015":"Test SDF Network ; September 2015"});export const signTransaction=async()=>{window.__signCalls=(window.__signCalls??0)+1;return {signedTxXdr:"signed"};};export const signMessage=async()=>({});`,
            loader: "js",
          }));
          // The real event fetcher is exercised separately by SDK tests. UI must distinguish failure from empty.
          b.onResolve({ filter: /^@lucent\/sdk$/ }, () => ({
            path: "sdk",
            namespace: "sdk-mock",
          }));
          b.onLoad({ filter: /.*/, namespace: "sdk-mock" }, () => ({
            contents: `export * from ${JSON.stringify(resolve(app, "../sdk/dist/index.js"))}; export class ChainClient{}; export async function hybridFetchEvents(){if(new URLSearchParams(location.search).has('historyError'))throw new Error('RPC history unavailable');return {events:[]};}`,
            loader: "js",
            resolveDir: app,
          }));
        },
      },
    ],
  });
  const js = await readFile(join(dir, "fixture.js"));
  const fontDir = resolve(app, "public/fonts");
  const fontFiles = (await readdir(fontDir)).filter((name) =>
    name.endsWith(".woff2"),
  );
  const fonts = new Map(
    await Promise.all(
      fontFiles.map(async (name) => [
        name,
        await readFile(resolve(fontDir, name)),
      ]),
    ),
  );
  server = createServer((req, res) => {
    if (req.url.startsWith("/fonts/")) {
      const bytes = fonts.get(
        new URL(req.url, "http://fixture").pathname.slice(7),
      );
      if (!bytes) {
        res.writeHead(404);
        res.end();
      } else {
        res.setHeader("Content-Type", "font/woff2");
        res.end(bytes);
      }
    } else if (req.url === "/fixture.css") {
      res.setHeader("Content-Type", "text/css");
      res.end(css);
    } else if (req.url === "/fixture.js") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(js);
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lucent UI test fixture</title><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>',
      );
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  const page = await browser.newPage({ reducedMotion: "reduce" });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error("Browser error:", e.message);
  });
  async function visit(path) {
    await page.goto(base + path);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
  }
  const B = "GBEYGMUUNP42QQRWZBKHAGNURZFE76ASFJ5QUEHA5UAXNEQFYCAKBQWO";
  async function payment(params = "") {
    await visit("/send" + params);
    await page.getByLabel("Recipient Stellar address").fill(B);
    await page.getByText("✓ Registered with Lucent").waitFor();
    await page.getByLabel("Amount (USDC)").fill("1.0000001");
    await page
      .getByRole("button", { name: "Review payment", exact: true })
      .click();
  }
  await visit("/home?state=disconnected");
  assert.equal(
    await page.getByRole("button", { name: "Connect Freighter" }).count(),
    1,
  );
  await visit("/home?state=unknown");
  await page.getByText("Account status unavailable", { exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Register confidential account" })
      .count(),
    0,
  );
  await visit("/home?state=unregistered");
  await page
    .getByRole("button", { name: "Register confidential account" })
    .click();
  await page.getByText("Action confirmed on Stellar Testnet").waitFor();
  await visit("/home?historyError=1");
  await page
    .getByText("RPC history unavailable")
    .waitFor({ state: "attached" });
  assert.equal(
    await page
      .getByText("No events in the available history", { exact: true })
      .count(),
    0,
  );
  await visit("/send?unregisteredRecipient=1");
  await page.getByLabel("Recipient Stellar address").fill(B);
  await page
    .getByText("This address is not registered", { exact: false })
    .waitFor();
  assert.ok(
    await page
      .getByRole("button", { name: "Review payment", exact: true })
      .isDisabled(),
  );
  await visit("/send?rpcError=1");
  await page.getByLabel("Recipient Stellar address").fill(B);
  await page.getByRole("button", { name: "Retry check" }).waitFor();
  assert.ok(
    await page
      .getByRole("button", { name: "Review payment", exact: true })
      .isDisabled(),
  );
  await payment("?result=declined");
  await page.getByRole("button", { name: "Confirm and send" }).click();
  await page.getByText("Wallet approval declined", { exact: true }).waitFor();
  assert.equal(
    await page.getByText("1.0000001 USDC", { exact: true }).count(),
    1,
  );
  await payment();
  await page.getByRole("button", { name: "Confirm and send" }).evaluate((b) => {
    b.click();
    b.click();
  });
  await page.getByText("Payment sent.", { exact: true }).waitFor();
  assert.equal(
    await page.evaluate(() => window.__calls),
    1,
    "Double click signs only once",
  );
  await payment("?result=timeout");
  await page.getByRole("button", { name: "Confirm and send" }).click();
  await page
    .getByText("Confirmation uncertain · check before retrying")
    .waitFor();
  assert.ok(
    await page.getByRole("button", { name: "Confirm and send" }).isDisabled(),
  );
  await page.reload();
  await page
    .getByText("Confirmation uncertain · check before retrying")
    .waitFor();
  await page
    .getByLabel("I checked the transaction outcome", { exact: false })
    .check();
  await page
    .getByRole("button", { name: "Enable actions after checking" })
    .click();
  await visit("/payroll");
  await page.getByRole("button", { name: "Open", exact: true }).first().click();
  await page.getByRole("button", { name: "Prepare payments" }).click();
  await page.getByLabel("Salary for recipient 1 (USDC)").fill("2.1234567");
  await page
    .getByRole("button", { name: "Review payroll", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm and pay batch" }).click();
  await page.getByText("All recipients paid", { exact: true }).waitFor();
  await visit("/payroll?result=declined");
  await page.getByRole("button", { name: "New template" }).click();
  await page.getByLabel("Recipient 1", { exact: true }).fill(B);
  await page
    .getByRole("button", { name: "Create template on Testnet" })
    .click();
  await page
    .getByRole("dialog")
    .getByText("Wallet approval declined", { exact: true })
    .waitFor();
  assert.equal(
    await page.getByLabel("Recipient 1", { exact: true }).inputValue(),
    B,
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", { name: "New template" }).click();
  await page
    .getByRole("button", { name: "Add recipient", exact: true })
    .click();
  await page.getByLabel("Recipient 2", { exact: true }).fill(B);
  assert.ok(
    await page
      .getByRole("button", { name: "Create template on Testnet" })
      .isDisabled(),
  );
  await visit("/escrow");
  await page.getByRole("button", { name: /Escrow #1/ }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("dialog", { name: "Review escrow action" }).waitFor();
  assert.equal(
    await page.evaluate(() => window.__calls ?? 0),
    0,
    "Escrow action requires review",
  );
  await visit("/home");
  assert.equal(await page.evaluate(() => window.__testFreighter()), "signed");
  await page.evaluate(() => (window.__wrongNetwork = true));
  assert.match(
    await page.evaluate(async () => {
      try {
        await window.__testFreighter();
        return "unexpected";
      } catch (e) {
        return e.message;
      }
    }),
    /Wrong network/,
  );
  assert.equal(await page.evaluate(() => window.__signCalls), 1);
  await page.evaluate(() => (window.__wrongNetwork = false));
  assert.match(
    await page.evaluate(async () => {
      try {
        await window.__testFreighter(true);
        return "unexpected";
      } catch (e) {
        return e.message;
      }
    }),
    /Wrong network/,
  );
  assert.equal(
    await page.evaluate(() => window.__signCalls),
    1,
    "Network checked again before signing",
  );
  const visualIssues = [];
  for (const width of [320, 390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["/home", "/send", "/payroll", "/escrow", "/profile"]) {
      await visit(route);
      if (route === "/send") {
        await page.getByLabel("Recipient Stellar address").fill(B);
        await page.getByText("✓ Registered with Lucent").waitFor();
        await page.getByLabel("Amount (USDC)").fill("1.25");
        await page
          .getByRole("button", { name: "Review payment", exact: true })
          .click();
      }
      if (route === "/payroll") {
        await page
          .getByRole("button", { name: "Open", exact: true })
          .first()
          .click();
      }
      if (route === "/escrow")
        await page.getByRole("button", { name: /Escrow #1/ }).click();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        `${route} overflow at ${width}`,
      );
      await page.waitForTimeout(250);
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
          nodes: v.nodes.map((n) => n.target),
        }));
      });
      if (violations.length) visualIssues.push({ route, width, violations });
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
        window.scrollTo({ top: 0, behavior: "instant" });
      });
      if ([390, 1440].includes(width))
        await page.screenshot({
          path: resolve(output, `mock-${route.slice(1)}-${width}.png`),
          fullPage: true,
        });
    }
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await visit("/");
  const orbit = page.locator(".orbit-rotation").first();
  const before = await orbit.evaluate((el) => getComputedStyle(el).transform);
  await page.waitForTimeout(200);
  const after = await orbit.evaluate((el) => getComputedStyle(el).transform);
  assert.notEqual(
    before,
    after,
    "Brand orbit animates with normal motion preferences",
  );
  const art = page.locator(".privacy-visual").first();
  const box = await art.boundingBox();
  await page.mouse.move(box.x + 30, box.y + 30);
  assert.notEqual(
    await art.evaluate((el) => el.style.getPropertyValue("--orbit-x")),
    "",
    "Artwork responds to pointer movement",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await orbit.evaluate((el) => getComputedStyle(el).animationName),
    "none",
    "Reduced motion stops decorative animations",
  );
  assert.deepEqual(visualIssues, [], "Connected accessibility checks");
  assert.deepEqual(errors, []);
  console.log(
    "UI integration: disconnected/unknown/setup; recipient errors; review; confirmed/declined/uncertain; reload; double-submit; payroll; dialog; escrow review passed (mocked).",
  );
} finally {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
  await rm(dir, { recursive: true, force: true });
}
