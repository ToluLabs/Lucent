/** Exercise the real provider's lazy-loading/reconnection lifecycle, without a wallet extension. */
import { build } from "esbuild";
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";
const app = resolve(import.meta.dirname, "..");
const dir = await mkdtemp(join(tmpdir(), "lucent-wallet-load-"));
let browser, server;
try {
  await build({
    stdin: {
      contents: `import React from 'react';import{createRoot}from'react-dom/client';import{WalletProvider,useWallet}from'./lib/wallet-context';function Probe(){const c=useWallet();return <><p id="status">{c.connecting?'connecting':c.wallet?'connected':'disconnected'}</p><p id="error">{c.error}</p><p id="view">{c.view?"available":"unavailable"}</p><button onClick={c.resync}>Recover</button><button onClick={c.connect}>Connect</button><button onClick={c.disconnect}>Disconnect</button></>;}createRoot(document.getElementById('root')).render(<WalletProvider><Probe/></WalletProvider>);`,
      resolveDir: app,
      loader: "tsx",
    },
    outdir: dir,
    entryNames: "entry",
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "browser",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"test"' },
    plugins: [
      {
        name: "wallet-boundaries",
        setup(b) {
          b.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: "navigation",
            namespace: "fixture",
          }));
          b.onResolve({ filter: /^\.\/wallet$/ }, (args) =>
            args.importer.endsWith("wallet-context.tsx")
              ? { path: "wallet", namespace: "fixture" }
              : undefined,
          );
          b.onResolve({ filter: /^\.\/(freighter|analytics)$/ }, (args) =>
            args.importer.endsWith("wallet-context.tsx")
              ? { path: args.path.slice(2), namespace: "fixture" }
              : undefined,
          );
          b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            loader: "js",
            resolveDir: app,
            contents:
              args.path === "navigation"
                ? `import{useState,useEffect}from'react';export function usePathname(){const[p,setP]=useState(location.pathname);useEffect(()=>{window.__go=setP;},[]);return p;}`
                : args.path === "freighter"
                  ? `export async function freighterIsAllowed(){window.__allowed=(window.__allowed??0)+1;return true;}`
                  : args.path === "analytics"
                    ? `export function trackEvent(){}`
                    : `window.__walletLoads=(window.__walletLoads??0)+1;export class ConfidentialWallet{static async connect(){window.__connections=(window.__connections??0)+1;if(window.__reject)throw new Error('Wallet declined');return{address:'fixture',async resync(){throw new Error('Recovery unavailable; state preserved');},async refresh(){window.__refreshes=(window.__refreshes??0)+1;return{registered:true,matchesChain:true};}};}}`,
          }));
        },
      },
    ],
  });
  server = createServer(async (req, res) => {
    const path = new URL(req.url, "http://fixture").pathname;
    if (path.endsWith(".js")) {
      try {
        const content = await readFile(join(dir, path.slice(1)));
        res.setHeader("Content-Type", "text/javascript");
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end();
      }
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>',
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
  async function fresh(manuallyDisconnected = false) {
    const context = await browser.newContext();
    if (manuallyDisconnected)
      await context.addInitScript(() =>
        localStorage.setItem("lucent:wallet:manually-disconnected", "1"),
      );
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(base);
    await page.waitForFunction(() => typeof window.__go === "function");
    return { context, page };
  }
  let { context, page } = await fresh();
  for (const path of ["/", "/docs", "/verify"]) {
    await page.evaluate((path) => window.__go(path), path);
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.__walletLoads ?? 0), 0);
    assert.equal(await page.evaluate(() => window.__allowed ?? 0), 0);
  }
  await page.evaluate(() => window.__go("/home"));
  await page.waitForFunction(
    () => document.querySelector("#status").textContent === "connected",
  );
  assert.equal(await page.evaluate(() => window.__walletLoads), 1);
  assert.equal(await page.evaluate(() => window.__allowed), 1);
  assert.equal(await page.evaluate(() => window.__refreshes), 1);
  await page.getByRole("button", { name: "Recover", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("#error").textContent ===
      "Recovery unavailable; state preserved",
  );
  assert.equal(
    await page.locator("#view").textContent(),
    "available",
    "Failed recovery retains the account view",
  );
  await page.evaluate(() => window.__go("/payroll"));
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(() => window.__connections),
    1,
    "No reconnect across wallet routes",
  );
  await context.close();
  ({ context, page } = await fresh(true));
  await page.evaluate(() => window.__go("/home"));
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(() => window.__walletLoads ?? 0),
    0,
    "Explicit disconnection is respected",
  );
  await page.evaluate(() => (window.__reject = true));
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#error").textContent === "Wallet declined",
  );
  assert.equal(await page.locator("#status").textContent(), "disconnected");
  await page.evaluate(() => (window.__reject = false));
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#status").textContent === "connected",
  );
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("lucent:wallet:manually-disconnected"),
    ),
    null,
  );
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await page.evaluate(() => window.__go("/docs"));
  await page.evaluate(() => window.__go("/home"));
  await page.waitForTimeout(100);
  assert.equal(await page.locator("#status").textContent(), "disconnected");
  await context.close();
  console.log(
    "Wallet loading: public pages defer the engine; wallet routes reconnect once; manual disconnect, failed connection and retry are preserved.",
  );
} finally {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
  await rm(dir, { recursive: true, force: true });
}
