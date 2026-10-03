import { describe, expect, it } from "vitest";
import {
  INSPECTOR_PX,
  PALETTE_PX,
  RAIL_PX,
  builderGridColumns,
  canvasWidthAt,
} from "../shell-tracks";
import { NODE_WIDTH } from "@/config/constants";

/**
 * The builder is a single CSS grid. These tests pin the arithmetic that keeps
 * the canvas usable: they run against the same constants `app-shell.tsx` renders
 * into `grid-template-columns`, so a change to a track width that breaks the
 * layout fails here rather than in a browser.
 */

const BOTH_OPEN = { paletteOpen: true, inspectorOpen: true };
const BOTH_COLLAPSED = { paletteOpen: false, inspectorOpen: false };

describe("builderGridColumns", () => {
  it("sizes both rails to their open width", () => {
    expect(builderGridColumns(BOTH_OPEN)).toBe("16rem minmax(0, 1fr) 20rem");
  });

  it("collapses a rail to the icon rail width", () => {
    expect(builderGridColumns({ paletteOpen: false, inspectorOpen: true })).toBe(
      "2.5rem minmax(0, 1fr) 20rem",
    );
    expect(builderGridColumns({ paletteOpen: true, inspectorOpen: false })).toBe(
      "16rem minmax(0, 1fr) 2.5rem",
    );
  });

  it("collapses both rails to two icon rails", () => {
    expect(builderGridColumns(BOTH_COLLAPSED)).toBe("2.5rem minmax(0, 1fr) 2.5rem");
  });

  it("always gives the canvas an explicit zero minimum track", () => {
    // `minmax(0, 1fr)`, never a bare `1fr`: `1fr` implies an `auto` minimum, so
    // a long label in the canvas would widen the track and shove the inspector
    // off-screen instead of being clipped.
    for (const rails of [
      BOTH_OPEN,
      BOTH_COLLAPSED,
      { paletteOpen: false, inspectorOpen: true },
      { paletteOpen: true, inspectorOpen: false },
    ]) {
      expect(builderGridColumns(rails)).toContain("minmax(0, 1fr)");
    }
  });

  it("emits rem so a larger root font size is respected", () => {
    expect(builderGridColumns(BOTH_OPEN)).toMatch(/^[\d.]+rem /);
  });
});

describe("canvasWidthAt — the widths the QA brief asks to be checked", () => {
  const both = { paletteOpen: true, inspectorOpen: true };

  it.each([
    [1024, 448],
    [1280, 704],
    [1440, 864],
    [1920, 1344],
  ])("leaves %ipx of canvas at a %ipx viewport with both rails open", (viewport, expected) => {
    expect(canvasWidthAt(viewport, both)).toBe(expected);
  });

  it("is widest at 1024px when both rails are collapsed", () => {
    expect(canvasWidthAt(1024, BOTH_COLLAPSED)).toBe(1024 - RAIL_PX * 2);
  });

  it("never lets the canvas fall below one node plus room to pan, at any tested width", () => {
    // NODE_WIDTH is 240px. A canvas that cannot show one node with margin is not
    // a usable canvas, which is exactly the failure the rails are collapsible for.
    for (const viewport of [1024, 1280, 1440, 1920]) {
      expect(canvasWidthAt(viewport, both)).toBeGreaterThanOrEqual(NODE_WIDTH + 80);
    }
  });

  it("gives back exactly the rail width when a rail collapses", () => {
    expect(canvasWidthAt(1440, { paletteOpen: false, inspectorOpen: true })).toBe(
      canvasWidthAt(1440, BOTH_OPEN) + (PALETTE_PX - RAIL_PX),
    );
    expect(canvasWidthAt(1440, { paletteOpen: true, inspectorOpen: false })).toBe(
      canvasWidthAt(1440, BOTH_OPEN) + (INSPECTOR_PX - RAIL_PX),
    );
  });

  it("clamps to zero rather than going negative on an impossible viewport", () => {
    expect(canvasWidthAt(100, BOTH_OPEN)).toBe(0);
  });
});
