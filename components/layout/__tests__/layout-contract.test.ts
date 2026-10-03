import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Layout contract.
 *
 * This sandbox has no browser (Chromium cannot be downloaded and there is no
 * Xvfb), so "nothing overlaps at 1440px" cannot be observed as pixels. These
 * tests are the next best thing: they assert the *structural* invariants that
 * overlap-freedom depends on, by reading the real shipped source rather than a
 * copy of it. A future edit that reintroduces an ad-hoc z-index or parks a
 * second panel in an occupied canvas corner fails here.
 *
 * They are source checks, not rendered-layout checks. That distinction is
 * stated plainly in FIXES.md rather than papered over.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function tsxFiles(dir: string): string[] {
  const abs = join(repoRoot, dir);
  return readdirSync(abs).flatMap((entry) => {
    const full = join(abs, entry);
    if (statSync(full).isDirectory()) return tsxFiles(join(dir, entry));
    return full.endsWith(".tsx") ? [full] : [];
  });
}

const rel = (path: string) => relative(repoRoot, path);

describe("single z-index scale", () => {
  const css = readFileSync(join(repoRoot, "app", "globals.css"), "utf8");

  it("defines the scale once, in the @theme block", () => {
    for (const token of [
      "page",
      "canvas-overlay",
      "canvas-toast",
      "dock",
      "menu",
      "overlay",
      "toast",
    ]) {
      expect(css, `--z-index-${token} missing from globals.css`).toContain(`--z-index-${token}:`);
    }
  });

  it("keeps the layers in a strictly sensible order", () => {
    const value = (token: string) => {
      const match = css.match(new RegExp(`--z-index-${token}:\\s*(\\d+)`));
      expect(match, `could not read --z-index-${token}`).not.toBeNull();
      return Number(match![1]);
    };

    // Chrome must sit above canvas overlays, menus above chrome, modals above
    // menus, and toasts above modals — otherwise a toast renders behind the
    // dialog that triggered it.
    expect(value("canvas-overlay")).toBeLessThan(value("canvas-toast"));
    expect(value("canvas-toast")).toBeLessThan(value("dock"));
    expect(value("dock")).toBeLessThan(value("menu"));
    expect(value("menu")).toBeLessThan(value("overlay"));
    expect(value("overlay")).toBeLessThan(value("toast"));
  });

  it("has no hand-written numeric z-index left in any component", () => {
    const offenders: string[] = [];
    for (const file of [...tsxFiles("components"), ...tsxFiles("app")]) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/(?<![\w-])z-\d+(?![\w-])/g)) {
        offenders.push(`${rel(file)}: ${match[0]}`);
      }
    }
    expect(offenders, `raw z-index utilities found:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("canvas corner occupancy", () => {
  const canvas = readFileSync(join(repoRoot, "components", "canvas", "flow-canvas.tsx"), "utf8");
  const controls = readFileSync(
    join(repoRoot, "components", "canvas", "zoom-controls.tsx"),
    "utf8",
  );

  it("does not park the MiniMap on the React Flow attribution's corner", () => {
    // React Flow pins its attribution to bottom-right and its terms require it
    // stay visible, so that corner is spoken for. The MiniMap used to share it.
    const position = canvas.match(/position="([a-z-]+)"/);
    expect(position, "MiniMap position prop not found").not.toBeNull();
    expect(position![1]).not.toBe("bottom-right");
    expect(position![1]).toBe("top-right");
  });

  it("keeps the attribution in the stylesheet and visible", () => {
    const css = readFileSync(join(repoRoot, "app", "globals.css"), "utf8");
    const block = css.slice(css.indexOf(".react-flow__attribution {"));
    expect(block.slice(0, block.indexOf("}"))).not.toMatch(/display:\s*none|visibility:\s*hidden/);
  });

  it("anchors the zoom controls to a corner the MiniMap does not use", () => {
    // Zoom controls are positioned by the caller, in flow-canvas.
    expect(canvas).toMatch(/bottom-5 left-5/);
    expect(controls).not.toMatch(/absolute/);
  });
});

describe("builder grid children can be shrunk", () => {
  const shell = readFileSync(
    join(repoRoot, "components", "layout", "app-shell.tsx"),
    "utf8",
  );

  it("uses minmax(0, 1fr) for the canvas track, never a bare 1fr", () => {
    // `1fr` implies an `auto` minimum, so long content in the canvas would widen
    // the track and push the inspector off-screen instead of being clipped.
    expect(shell).toContain("minmax(0, 1fr)");
  });

  it("gives the canvas cell min-w-0 and overflow-hidden", () => {
    expect(shell).toMatch(/<main className="relative min-w-0 overflow-hidden">/);
  });
});
