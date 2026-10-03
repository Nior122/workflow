/**
 * Capture the README screenshots against a production build.
 *
 * This exists because the project was authored in a sandbox with no browser binary
 * available, so the README ships without images rather than with fabricated ones.
 *
 * Usage:
 *   npm i -D playwright && npx playwright install chromium
 *   npm run docs:screenshots
 *
 * It builds, serves, drives a real Chromium, and writes docs/screenshots/*.png.
 *
 * NOTE: the selectors below target accessible names rather than CSS classes, so they
 * survive styling changes — but they are the part of this script most likely to need
 * updating if the UI copy changes.
 */

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "docs", "screenshots");
const PORT = process.env.PORT ? Number(process.env.PORT) : 4310;
const BASE = `http://localhost:${PORT}`;

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    console.error(
      [
        "Playwright is not installed. Run:",
        "",
        "  npm i -D playwright && npx playwright install chromium",
        "  npm run docs:screenshots",
        "",
      ].join("\n"),
    );
    process.exit(1);
  }
}

function run(command, args, options = {}) {
  const child = spawn(command, args, { cwd: ROOT, stdio: "inherit", ...options });
  child.on("error", (error) => {
    console.error(`Failed to start \`${command}\`:`, error.message);
    process.exit(1);
  });
  return child;
}

async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not become ready at ${url}`);
}

const SHOTS = [
  { file: "01-landing.png", url: "/", width: 1440, height: 900, fullPage: true },
  { file: "02-builder-empty.png", url: "/builder", width: 1600, height: 1000 },
  { file: "03-running.png", url: "/builder", width: 1600, height: 1000, step: "running" },
  { file: "04-console.png", url: "/builder", width: 1600, height: 1000, step: "console" },
  { file: "05-templates.png", url: "/builder", width: 1440, height: 900, step: "templates" },
];

async function shoot(page, shot) {
  await page.setViewportSize({ width: shot.width, height: shot.height });
  await page.goto(`${BASE}${shot.url}`, { waitUntil: "networkidle" });

  if (shot.step === "templates") {
    await page.getByRole("button", { name: /^Templates$/ }).click();
    await page.getByRole("heading", { name: /start from a template/i }).waitFor();
  }

  if (shot.step === "running" || shot.step === "console") {
    // Load a real flow so there is something worth photographing.
    await page.getByRole("button", { name: /^Templates$/ }).click();
    await page
      .getByRole("article")
      .filter({ hasText: "Lead capture" })
      .getByRole("button", { name: /^Load$/ })
      .click();

    // Let the template land and the layout settle.
    await page.waitForTimeout(600);

    await page.getByRole("button", { name: /run/i }).first().click();

    if (shot.step === "running") {
      // Catch it mid-flight, while particles are on the edges.
      await page.waitForTimeout(1600);
    } else {
      await page.getByText(/run completed|completed/i).first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(400);
      const step = page.getByRole("button", { name: /step|node/i }).first();
      if (await step.count()) await step.click();
    }
  }

  await page.screenshot({
    path: path.join(OUT, shot.file),
    fullPage: Boolean(shot.fullPage),
  });
  console.log(`  wrote docs/screenshots/${shot.file}`);
}

const { chromium } = await loadPlaywright();

console.log("▸ building");
run("npm", ["run", "build"]).on("exit", async (code) => {
  if (code !== 0) process.exit(code ?? 1);

  console.log(`▸ serving on :${PORT}`);
  const server = run("npm", ["start"], { env: { ...process.env, PORT: String(PORT) } });

  try {
    await waitForServer(`${BASE}/builder`);
    await mkdir(OUT, { recursive: true });

    const browser = await chromium.launch();
    const context = await browser.newContext({
      deviceScaleFactor: 2,
      colorScheme: "dark",
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();

    console.log("▸ capturing");
    for (const shot of SHOTS) await shoot(page, shot);

    await browser.close();
    console.log(`\nDone — ${SHOTS.length} images in docs/screenshots/`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.kill("SIGTERM");
  }
});
