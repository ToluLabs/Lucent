#!/usr/bin/env node
/**
 * UI smoke check. Starts the app in development (demo mode needs it), visits
 * every route in both themes at desktop and phone widths, and fails on:
 *   - horizontal page overflow
 *   - axe-core violations of "serious" or "critical" impact
 *   - unexpected console errors
 * Screenshots of every combination land in packages/app/.ui-check/ so a
 * reviewer can eyeball them. There are no baselines to maintain.
 *
 * Usage:   pnpm --filter @lucent/app test:ui
 * Browser: uses Playwright's Chromium (`pnpm exec playwright install chromium`),
 *          or set PLAYWRIGHT_CHROMIUM_EXECUTABLE to an existing Chrome/Chromium.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../packages/app/package.json"));
const { chromium } = require("playwright");
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "../packages/app");
const OUT_DIR = join(APP_DIR, ".ui-check");
const PORT = process.env.UI_CHECK_PORT ?? "3100";
const BASE = `http://localhost:${PORT}`;

/** [route, needs demo wallet] */
const ROUTES = [
  ["/", false],
  ["/about", false],
  ["/stats", false],
  ["/docs", false],
  ["/verify", false],
  ["/auditor", true],
  ["/home", true],
  ["/shield", true],
  ["/send", true],
  ["/payroll", true],
  ["/escrow", true],
  ["/profile", true],
];
const THEMES = ["dark", "light"];
const VIEWPORTS = { desktop: { width: 1360, height: 860 }, phone: { width: 390, height: 844 } };

// Failures that come from having no chain access, not from the UI.
const IGNORED_CONSOLE = [/Failed to load resource/i, /fetch/i, /net::ERR/i, /ERR_CONNECTION/i, /NetworkError/i, /Failed to fetch/i];

async function waitForServer(url, ms = 90_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`dev server did not start at ${url}`);
}

const server = spawn("pnpm", ["exec", "next", "dev", "--webpack", "-p", PORT], { cwd: APP_DIR, stdio: "ignore" });
const stop = () => server.kill("SIGTERM");
process.on("exit", stop);
process.on("SIGINT", () => process.exit(130));

mkdirSync(OUT_DIR, { recursive: true });
const problems = [];

try {
  await waitForServer(BASE);
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });

  for (const theme of THEMES) {
    for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
      const ctx = await browser.newContext({ viewport });
      await ctx.addInitScript((t) => localStorage.setItem("lucent-theme", t), theme);
      const page = await ctx.newPage();
      const consoleErrors = [];
      page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
      page.on("pageerror", (e) => consoleErrors.push(String(e)));

      for (const [route, demo] of ROUTES) {
        const label = `${route} [${theme}, ${vpName}]`;
        consoleErrors.length = 0;
        await page.goto(`${BASE}${route}${demo ? "?demo=1" : ""}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(700);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 1) problems.push(`${label}: page scrolls horizontally by ${overflow}px`);

        await page.addScriptTag({ content: axeSource });
        const { violations } = await page.evaluate(() => window.axe.run(document, { resultTypes: ["violations"] }));
        for (const v of violations.filter((x) => x.impact === "serious" || x.impact === "critical")) {
          const sample = v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ");
          problems.push(`${label}: axe ${v.id} (${v.impact}, ${v.nodes.length} nodes) ${sample}`);
        }

        for (const msg of consoleErrors) {
          if (!IGNORED_CONSOLE.some((rx) => rx.test(msg))) problems.push(`${label}: console error: ${msg.slice(0, 160)}`);
        }

        const file = `${route === "/" ? "landing" : route.slice(1)}-${theme}-${vpName}.png`;
        await page.screenshot({ path: join(OUT_DIR, file) });
      }
      await ctx.close();
    }
  }
  await browser.close();
} finally {
  stop();
}

if (problems.length) {
  console.error(`\n${problems.length} UI problem(s):\n` + problems.map((p) => ` - ${p}`).join("\n"));
  process.exit(1);
}
console.log(`UI check passed. Screenshots in ${OUT_DIR}`);
