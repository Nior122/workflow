#!/usr/bin/env node
/**
 * WCAG 2.1 contrast check for both themes.
 *
 * Reads the HSL tokens straight out of app/globals.css rather than duplicating
 * them here, so a colour change in the stylesheet is what gets measured.
 *
 *   node scripts/check-contrast.mjs
 *
 * Exits 1 if any pair falls below its threshold. Text pairs need 4.5:1 (AA
 * normal text); the ember button label and large decorative text need 3:1.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "app", "globals.css"), "utf8");

function block(selector) {
  // Match the declaration, not any earlier mention: `.dark` also appears inside
  // `@custom-variant dark (&:is(.dark *))`, and slicing from there silently
  // returns the :root tokens instead — which is why both themes can look
  // identical when this goes wrong.
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`no "${selector} {" block in globals.css`);
  return css.slice(start, css.indexOf("}", start));
}

function tokens(selector) {
  const out = {};
  for (const [, name, value] of block(selector).matchAll(/--([a-z-]+):\s*([\d.]+ [\d.]+% [\d.]+%)/g)) {
    out[name] = value;
  }
  return out;
}

function hslToRgb([h, s, l]) {
  const S = s / 100;
  const L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = L - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}

function luminance(hsl) {
  // "60 9% 98%" — parseFloat, not Number: Number("9%") is NaN.
  const [r, g, b] = hslToRgb(hsl.split(/\s+/).map((part) => Number.parseFloat(part))).map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [label, foreground token, background token, required ratio] */
const PAIRS = [
  ["body text on page", "foreground", "background", 4.5],
  ["body text on panel", "foreground", "surface", 4.5],
  ["body text on raised", "foreground", "surface-raised", 4.5],
  ["muted text on page", "muted-foreground", "background", 4.5],
  ["muted text on panel", "muted-foreground", "surface", 4.5],
  ["muted text on raised", "muted-foreground", "surface-raised", 4.5],
  ["accent on page", "accent", "background", 4.5],
  ["accent on raised", "accent", "surface-raised", 4.5],
  ["success on raised", "success", "surface-raised", 4.5],
  ["error on raised", "error", "surface-raised", 4.5],
  ["warning on raised", "warning", "surface-raised", 4.5],
  // The Run button label sits on the ember gradient, so both stops must clear
  // it. Large/bold text qualifies for the 3:1 AA threshold.
  ["button label on accent", "accent-contrast", "accent", 3],
  ["button label on accent-hot", "accent-contrast", "accent-hot", 3],
];

let worst = Infinity;
let failures = 0;

for (const [themeName, selector] of [["light", ":root"], ["dark", ".dark"]]) {
  const t = tokens(selector);
  console.log(`\n${themeName}`);
  for (const [label, fg, bg, min] of PAIRS) {
    const value = ratio(t[fg], t[bg]);
    worst = Math.min(worst, value);
    const ok = value >= min;
    if (!ok) failures++;
    console.log(
      `  ${ok ? "pass" : "FAIL"}  ${value.toFixed(2).padStart(5)}:1  (need ${min})  ${label}`,
    );
  }
}

console.log(`\nworst pair: ${worst.toFixed(2)}:1 — ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
